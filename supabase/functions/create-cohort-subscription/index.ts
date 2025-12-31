import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    console.warn('Rate limit exceeded for IP:', clientIp);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { tier, billingPeriod, customerEmail, customerName, couponCode } = await req.json();
    
    console.log('Cohort subscription request:', { tier, billingPeriod, customerEmail, customerName, couponCode });

    if (!tier || !customerEmail || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tier, customerEmail, customerName' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tier
    const validTiers = ['premium', 'vip'];
    if (!validTiers.includes(tier)) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier. Must be "premium" or "vip"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate billing period
    const validPeriods = ['monthly', 'annual'];
    const period = validPeriods.includes(billingPeriod) ? billingPeriod : 'monthly';

    // Check for LEGACYSTUDENT coupon - only valid for Premium Monthly
    const isLegacyStudent = couponCode?.toUpperCase() === 'LEGACYSTUDENT' && tier === 'premium' && period === 'monthly';
    
    if (isLegacyStudent) {
      console.log('LEGACYSTUDENT coupon applied - first month free');
    }

    // Set price based on tier and billing period
    const priceConfig = {
      premium: {
        monthly: { amount: 4700, name: 'Premium Cohort Membership (Monthly)', interval: 'month' as const },
        annual: { amount: 39700, name: 'Premium Cohort Membership (Annual)', interval: 'year' as const }
      },
      vip: {
        monthly: { amount: 29700, name: 'VIP Cohort Mentorship (Monthly)', interval: 'month' as const },
        annual: { amount: 249700, name: 'VIP Cohort Mentorship (Annual)', interval: 'year' as const }
      }
    };

    const { amount, name, interval } = priceConfig[tier as keyof typeof priceConfig][period as 'monthly' | 'annual'];

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get origin with fallback
    const origin = req.headers.get("origin") || "https://lowendcandy.com";

    // Build subscription data with optional trial for LEGACYSTUDENT
    const subscriptionData: any = {};
    if (isLegacyStudent) {
      subscriptionData.trial_period_days = 30; // Free first month
    }

    // Create Stripe checkout session for one-time payment (manual recurring for now)
    const session = await stripe.checkout.sessions.create({
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: isLegacyStudent ? `${name} (First Month Free)` : name,
              description: `${interval === 'year' ? 'Annual' : 'Monthly'} membership to the Low End Candy Collective - ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier${isLegacyStudent ? ' - LEGACYSTUDENT discount applied' : ''}`
            },
            unit_amount: isLegacyStudent ? 0 : amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/collective/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${origin}/collective/join`,
      metadata: {
        tier: tier,
        billing_period: period,
        customer_name: customerName,
        customer_email: customerEmail,
        coupon_code: couponCode || '',
        product_type: 'cohort_membership'
      },
    });

    console.log('Stripe checkout session created:', session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Cohort subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to create checkout session. Please try again.' }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
