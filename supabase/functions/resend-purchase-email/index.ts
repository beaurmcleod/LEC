import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, isAdminOrServiceRole, unauthorized } from "../_shared/auth-guard.ts";

const requestSchema = z.object({
  customerEmail: z.string().email(),
  productId: z.string().uuid(),
  ccEmail: z.string().email().optional(),
  sendEmail: z.boolean().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isAdminOrServiceRole(req))) return unauthorized("Admin access required");

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { customerEmail, productId, ccEmail, sendEmail = true } = validation.data;

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
      const paymentId = `manual_resend_${Date.now()}`;
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          product_id: productId,
          stripe_payment_id: paymentId,
          amount_paid: 0,
          customer_email: customerEmail,
        });

      if (purchaseError) {
        console.error('Error creating purchase:', purchaseError);
      } else {
        console.log('Created purchase record for:', customerEmail);
      }
    }

    // Generate secure download token
    const downloadToken = crypto.randomUUID() + '-' + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: tokenError } = await supabase
      .from('download_tokens')
      .insert({
        token: downloadToken,
        product_id: productId,
        customer_email: customerEmail,
        expires_at: expiresAt.toISOString(),
        max_downloads: 10
      });

    if (tokenError) {
      console.error('Error creating download token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create download token' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceStr = product.price.replace(/[^0-9.]/g, '');
    const amount = parseFloat(priceStr) || 0;

    if (sendEmail) {
      // Send email via send-purchase-email (which now uses sendEmailWithFailsafe)
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
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: sendEmail
          ? `Email sent to ${customerEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`
          : `Download token prepared for ${customerEmail}`,
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
