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

const STORE_SITE = "lowendcandy";

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

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeProductLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

    // Optional auth - try to get user if logged in, but allow guests
    let user: { id: string; email?: string } | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: authUser } } = await userClient.auth.getUser();
        if (authUser) user = authUser;
      } catch (e) {
        console.log('Auth check failed, proceeding as guest:', e);
      }
    }

    const body = await req.json();
    
    // Input validation with zod
    const paymentSchema = z.object({
      productId: z.string().min(1, { message: "Product ID is required" }),
      productTitle: z.string().max(255).optional(),
      customerEmail: z.string().email().max(255).optional(),
      customerFirstName: z.string().max(100).optional(),
      customerLastName: z.string().max(100).optional(),
      couponCode: z.string().optional(),
      healthcheck: z.boolean().optional(),
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

    const {
      productId,
      productTitle,
      customerEmail: providedEmail,
      customerFirstName,
      customerLastName,
      couponCode,
      healthcheck,
      isLesson,
      lessonId,
      lessonDate,
      lessonTime,
    } = validation.data;
    // Use authenticated user's email, falling back to provided email
    const customerEmail = user?.email || providedEmail;

    // SECURITY: Fetch actual price from database instead of trusting client
    // Support UUID, exact title, and slugified title lookup
    // Check if productId is a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let product: { id: string; price: string; title: string } | null = null;

    if (uuidRegex.test(productId)) {
      console.log('Looking up product by UUID:', productId);
      const { data, error } = await supabase
        .from('products')
        .select('id, price, title')
        .eq('site', STORE_SITE)
        .eq('id', productId)
        .maybeSingle();

      if (error) {
        console.error('UUID product lookup error:', error);
      } else {
        product = data;
      }
    }

    if (!product && productTitle?.trim()) {
      console.log('Looking up product by exact title:', productTitle);
      const { data, error } = await supabase
        .from('products')
        .select('id, price, title')
        .eq('site', STORE_SITE)
        .ilike('title', productTitle.trim())
        .maybeSingle();

      if (error) {
        console.error('Exact title lookup error:', error);
      } else {
        product = data;
      }
    }

    if (!product) {
      const normalizedIdentifier = normalizeProductLookup(productId || productTitle || '');
      console.log('Looking up product by normalized title slug:', normalizedIdentifier);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, price, title')
        .eq('site', STORE_SITE);

      if (productsError) {
        console.error('Fallback product lookup error:', productsError);
      } else {
        product = (products || []).find((candidate) => {
          const normalizedTitle = normalizeProductLookup(candidate.title);
          return normalizedTitle === normalizedIdentifier;
        }) || null;
      }
    }

    if (!product) {
      console.error('Product not found for checkout:', { productId, productTitle });
      return jsonResponse({
        error: 'PRODUCT_NOT_FOUND',
        message: 'This checkout link is out of date. Please return to the store and open the product again.',
        fallback: true,
      });
    }

    const rawPrice = (product.price || '').toString().trim();
    const isFreeProduct = rawPrice.toLowerCase() === 'free';
    const parsedPrice = isFreeProduct ? 0 : parseFloat(rawPrice.replace('$', ''));
    if (!isFreeProduct && Number.isNaN(parsedPrice)) {
      console.error('Invalid product price configuration:', product);
      return jsonResponse({
        error: 'PRODUCT_CONFIGURATION_ERROR',
        message: 'This product is temporarily unavailable. Please contact support if you need help checking out.',
        fallback: true,
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeSecretKey) {
      console.error('Missing STRIPE_SECRET_KEY');
      return jsonResponse({
        error: 'PAYMENT_SERVICE_UNAVAILABLE',
        message: 'Checkout is temporarily unavailable. Please try again in a few minutes or contact support.',
        fallback: true,
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Convert database price to cents
    let priceInCents = Math.round(parsedPrice * 100);
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

        } else {
          console.log(`Coupon ${upperCoupon} not valid: expired=${isExpired}, maxUsesReached=${maxUsesReached}, appliesToProduct=${appliesToProduct}`);
        }
      } else {
        console.log(`Coupon ${upperCoupon} not found or inactive`);
      }
    }

    console.log('Creating payment intent for product:', product.title, 'amount:', priceInCents, 'discountApplied:', discountApplied, 'isLesson:', isLesson);

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Customer email is required to complete checkout.' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
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

    if (user?.id) {
      metadata.user_id = user.id;
    }
    
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

    if (healthcheck) {
      console.log('Health check request validated for product:', product.title);
      return jsonResponse({
        ready: true,
        amount: priceInCents,
        currency: 'usd',
        productId: product.id,
        productTitle: product.title,
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
    return jsonResponse({
      error: 'PAYMENT_SERVICE_UNAVAILABLE',
      message: 'Checkout is temporarily unavailable. Please try again in a few minutes or contact support.',
      fallback: true,
    });
  }
});