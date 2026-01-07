import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  productId: z.string().uuid(),
  customerEmail: z.string().email(),
  couponCode: z.string().min(1),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productId, customerEmail, couponCode } = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate coupon code from database
    const upperCoupon = couponCode.toUpperCase();
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', upperCoupon)
      .eq('is_active', true)
      .maybeSingle();

    if (!coupon || couponError) {
      return new Response(
        JSON.stringify({ error: 'Invalid coupon code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if coupon is expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Coupon has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max uses reached
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return new Response(
        JSON.stringify({ error: 'Coupon usage limit reached' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if coupon applies to this product
    const appliesToProduct = coupon.applies_to_all || 
      (coupon.product_ids && coupon.product_ids.includes(productId));
    
    if (!appliesToProduct) {
      return new Response(
        JSON.stringify({ error: 'Coupon does not apply to this product' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get product info
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('title')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();

    // Create $0 purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        product_id: productId,
        customer_email: customerEmail,
        amount_paid: 0,
        stripe_payment_id: `coupon_${couponCode}_${Date.now()}`,
        user_id: profile?.id || null,
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Purchase creation error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to create purchase record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate download token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const { error: tokenError } = await supabase
      .from('download_tokens')
      .insert({
        token,
        product_id: productId,
        customer_email: customerEmail,
        expires_at: expiresAt.toISOString(),
        max_downloads: 5,
      });

    if (tokenError) {
      console.error('Token creation error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get download info
    const { data: productDownload, error: downloadError } = await supabase
      .from('product_downloads')
      .select('download_path, download_url')
      .eq('product_id', productId)
      .single();

    if (downloadError) {
      console.error('Download info error:', downloadError);
    }

    console.log('Product download info:', productDownload);

    let downloadUrl = '';

    // Generate signed URL if using storage
    if (productDownload?.download_path) {
      const { data: signedUrlData, error: storageError } = await supabase.storage
        .from('product-downloads')
        .createSignedUrl(productDownload.download_path, 86400); // 24 hours

      console.log('Signed URL result:', { signedUrlData, storageError });

      if (signedUrlData?.signedUrl) {
        downloadUrl = signedUrlData.signedUrl;
      }
    } else if (productDownload?.download_url) {
      downloadUrl = productDownload.download_url;
    }

    console.log('Final download URL:', downloadUrl);

    // Send purchase email
    try {
      await supabase.functions.invoke('send-purchase-email', {
        body: {
          to: customerEmail,
          productTitle: product.title,
          amount: 0,
          paymentIntentId: `coupon_${couponCode}_${Date.now()}`,
          productId,
          downloadToken: token,
        },
      });
      console.log('Purchase email sent to:', customerEmail);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the entire request if email fails
    }

    // Increment coupon usage
    await supabase
      .from('coupons')
      .update({ current_uses: coupon.current_uses + 1 })
      .eq('id', coupon.id);

    console.log('Coupon redeemed successfully:', { productId, customerEmail, couponCode });

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl,
        productTitle: product.title,
        token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in redeem-coupon:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
