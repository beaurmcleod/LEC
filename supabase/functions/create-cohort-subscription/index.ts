import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { Resend } from "npm:resend@2.0.0";

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
    const { tier, customerEmail, customerName } = await req.json();
    
    console.log('Cohort subscription request:', { tier, customerEmail, customerName });

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

    // Set price based on tier
    const priceConfig = {
      premium: { amount: 4700, name: 'Premium Cohort Membership', interval: 'month' as const },
      vip: { amount: 29700, name: 'VIP Cohort Mentorship', interval: 'month' as const }
    };

    const { amount, name, interval } = priceConfig[tier as keyof typeof priceConfig];

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: name,
              description: `Monthly subscription to the Low End Candy Collective - ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`
            },
            unit_amount: amount,
            recurring: {
              interval: interval
            }
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/collective/success?session_id={CHECKOUT_SESSION_ID}&tier=${tier}`,
      cancel_url: `${req.headers.get("origin")}/collective/join`,
      metadata: {
        tier: tier,
        customer_name: customerName,
        customer_email: customerEmail,
        product_type: 'cohort_subscription'
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
