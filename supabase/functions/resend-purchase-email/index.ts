import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  customerEmail: z.string().email(),
  productId: z.string().uuid(),
  ccEmail: z.string().email().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { customerEmail, productId, ccEmail } = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, title, price')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if purchase exists, if not create one
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id')
      .eq('customer_email', customerEmail)
      .eq('product_id', productId)
      .maybeSingle();

    if (!existingPurchase) {
      // Create purchase record
      const paymentId = `manual_resend_${Date.now()}`;
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          product_id: productId,
          stripe_payment_id: paymentId,
          amount_paid: 0, // Manual resend
          customer_email: customerEmail,
        });

      if (purchaseError) {
        console.error('Error creating purchase:', purchaseError);
      } else {
        console.log('Created purchase record for:', customerEmail);
      }
    }

    // Generate secure download token (30-day expiry, 10 downloads max for manual resends)
    const downloadToken = crypto.randomUUID() + '-' + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for manual resends

    const { error: tokenError } = await supabase
      .from('download_tokens')
      .insert({
        token: downloadToken,
        product_id: productId,
        customer_email: customerEmail,
        expires_at: expiresAt.toISOString(),
        max_downloads: 10 // More generous for manual resends
      });

    if (tokenError) {
      console.error('Error creating download token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create download token' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Download token created for:', customerEmail, 'expires:', expiresAt.toISOString());

    // Parse price
    const priceStr = product.price.replace(/[^0-9.]/g, '');
    const amount = parseFloat(priceStr) || 0;

    // Send email to customer
    const { error: emailError } = await supabase.functions.invoke("send-purchase-email", {
      body: {
        to: customerEmail,
        productTitle: product.title,
        amount: amount,
        paymentIntentId: `resend_${Date.now()}`,
        productId: productId,
        downloadToken: downloadToken,
      },
    });

    if (emailError) {
      console.error('Error sending email to customer:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Email sent to customer:', customerEmail);

    // Send CC copy if requested
    if (ccEmail) {
      const { error: ccError } = await supabase.functions.invoke("send-purchase-email", {
        body: {
          to: ccEmail,
          productTitle: `[CC] ${product.title} - Sent to ${customerEmail}`,
          amount: amount,
          paymentIntentId: `resend_cc_${Date.now()}`,
          productId: productId,
          downloadToken: downloadToken,
        },
      });

      if (ccError) {
        console.error('Error sending CC email:', ccError);
      } else {
        console.log('CC email sent to:', ccEmail);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email sent to ${customerEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`,
        token: downloadToken,
        expires: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in resend-purchase-email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
