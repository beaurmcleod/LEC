import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting by IP
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    console.warn('Rate limit exceeded for IP:', clientIp);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    console.log('Payment intent request received');

    // Require authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please sign in to make a purchase.' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session. Please sign in again.' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Input validation with zod
    const paymentSchema = z.object({
      productId: z.string().min(1, { message: "Product ID is required" }),
      customerEmail: z.string().email().max(255).optional(),
      customerFirstName: z.string().max(100).optional(),
      customerLastName: z.string().max(100).optional(),
      couponCode: z.string().optional(),
      // Lesson booking fields
      isLesson: z.boolean().optional(),
      lessonId: z.string().optional(),
      lessonDate: z.string().optional(),
      lessonTime: z.string().optional(),
    });

    const validation = paymentSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => e.message)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { productId, customerEmail: providedEmail, customerFirstName, customerLastName, couponCode, isLesson, lessonId, lessonDate, lessonTime } = validation.data;
    // Use authenticated user's email, falling back to provided email
    const customerEmail = user.email || providedEmail;

    // SECURITY: Fetch actual price from database instead of trusting client
    // Support both UUID and title/slug lookup
    let query = supabase.from('products').select('id, price, title');
    
    // Check if productId is a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(productId)) {
      console.log('Looking up product by UUID:', productId);
      query = query.eq('id', productId);
    } else {
      // Convert slug to title (e.g., "27-ott-rack" -> "27 OTT Rack")
      const titleFromSlug = productId.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      console.log('Looking up product by title:', titleFromSlug);
      query = query.eq('title', titleFromSlug);
    }
    
    const { data: product, error: productError } = await query.single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      throw new Error("Product not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Convert database price to cents
    let priceInCents = Math.round(parseFloat(product.price.replace('$', '')) * 100);
    let discountApplied = '';
    const upperCoupon = couponCode?.toUpperCase() || '';

    // Validate and apply coupon code from database
    if (upperCoupon) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', upperCoupon)
        .eq('is_active', true)
        .maybeSingle();

      if (coupon && !couponError) {
        // Check if coupon is expired
        const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
        // Check if max uses reached
        const maxUsesReached = coupon.max_uses && coupon.current_uses >= coupon.max_uses;
        // Check if coupon applies to this product
        const appliesToProduct = coupon.applies_to_all || 
          (coupon.product_ids && coupon.product_ids.includes(product.id));

        if (!isExpired && !maxUsesReached && appliesToProduct) {
          if (coupon.discount_type === 'fixed_price') {
            priceInCents = Math.round(coupon.discount_value * 100);
            discountApplied = `Fixed price: $${coupon.discount_value}`;
            console.log(`Coupon ${upperCoupon} applied, fixed price: $${coupon.discount_value}`);
          } else if (coupon.discount_type === 'percentage') {
            const discountMultiplier = (100 - coupon.discount_value) / 100;
            priceInCents = Math.round(priceInCents * discountMultiplier);
            discountApplied = `${coupon.discount_value}%`;
            console.log(`Coupon ${upperCoupon} applied, ${coupon.discount_value}% discount`);
          } else if (coupon.discount_type === 'fixed_amount') {
            priceInCents = Math.max(0, priceInCents - Math.round(coupon.discount_value * 100));
            discountApplied = `$${coupon.discount_value} off`;
            console.log(`Coupon ${upperCoupon} applied, $${coupon.discount_value} off`);
          }

          // Increment coupon usage
          await supabase
            .from('coupons')
            .update({ current_uses: coupon.current_uses + 1 })
            .eq('id', coupon.id);
        } else {
          console.log(`Coupon ${upperCoupon} not valid: expired=${isExpired}, maxUsesReached=${maxUsesReached}, appliesToProduct=${appliesToProduct}`);
        }
      } else {
        console.log(`Coupon ${upperCoupon} not found or inactive`);
      }
    }

    console.log('Creating payment intent for product:', product.title, 'amount:', priceInCents, 'discountApplied:', discountApplied, 'isLesson:', isLesson);
    
    // Build metadata object
    const metadata: Record<string, string> = {
      product_id: product.id,
      product_title: product.title,
      site: 'lowendcandy',
      source_app: 'lowendcandy_store',
      customer_first_name: customerFirstName || '',
      customer_last_name: customerLastName || '',
      coupon_code: discountApplied ? upperCoupon : '',
      discount_applied: discountApplied,
    };
    
    // Add lesson metadata if applicable
    if (isLesson) {
      metadata.is_lesson = 'true';
      metadata.lesson_id = lessonId || '';
      metadata.lesson_date = lessonDate || '';
      metadata.lesson_time = lessonTime || '';
    }
    
    // Handle free or below-minimum purchases (Stripe requires minimum $0.50)
    if (priceInCents < 50) {
      console.log('Price below Stripe minimum ($0.50) - treating as free purchase');
      return new Response(JSON.stringify({ 
        free: true,
        amount: priceInCents,
        currency: "usd",
        metadata
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    // Create a payment intent for embedded checkout
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInCents,
      currency: "usd",
      description: `${product.title} - Digital music production content`,
      receipt_email: customerEmail || undefined,
      metadata,
    });

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(JSON.stringify({ 
      client_secret: paymentIntent.client_secret,
      amount: priceInCents,
      currency: "usd"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to create payment. Please try again or contact support.' }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});