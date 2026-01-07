import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { couponCode, productId, originalPrice } = await req.json();

    if (!couponCode || !productId || originalPrice === undefined) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const code = couponCode.toUpperCase();
    
    // Validate coupon from database
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, applies_to_all, product_ids, max_uses, current_uses, expires_at, is_active')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !coupon) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid coupon code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "This coupon has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: "This coupon has reached its usage limit" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if applies to this product
    const appliesToProduct = coupon.applies_to_all || 
      (coupon.product_ids && coupon.product_ids.includes(productId));
    
    if (!appliesToProduct) {
      return new Response(
        JSON.stringify({ valid: false, error: "This coupon does not apply to this product" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate discounted price
    const originalPriceNum = parseFloat(String(originalPrice));
    let newPrice: number;
    let message: string;
    
    if (coupon.discount_type === 'fixed_price') {
      newPrice = parseFloat(String(coupon.discount_value));
      message = `Price reduced to $${newPrice.toFixed(2)}!`;
    } else if (coupon.discount_type === 'percentage') {
      newPrice = originalPriceNum * (1 - parseFloat(String(coupon.discount_value)) / 100);
      message = `${coupon.discount_value}% discount applied!`;
    } else {
      newPrice = Math.max(0, originalPriceNum - parseFloat(String(coupon.discount_value)));
      message = `$${coupon.discount_value} off applied!`;
    }

    // Return only the calculated result, NOT the coupon details
    return new Response(
      JSON.stringify({ 
        valid: true, 
        discountedPrice: newPrice.toFixed(2),
        message,
        couponCode: code
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error validating coupon:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
