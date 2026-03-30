import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate input
    const { product_slug } = await req.json();
    if (
      !product_slug ||
      typeof product_slug !== "string" ||
      !["crux-chords-monthly", "crux-chords-annual"].includes(product_slug)
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid product_slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up site_product
    const { data: product, error: prodErr } = await supabase
      .from("site_products")
      .select("id, slug, name, price_cents, billing_period")
      .eq("slug", product_slug)
      .eq("is_active", true)
      .maybeSingle();

    if (prodErr || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .in("site_product_slug", ["crux-chords-monthly", "crux-chords-annual"])
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existingSub) {
      return new Response(
        JSON.stringify({ error: "You already have an active CRUX Chords subscription" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    const interval = product.billing_period === "annual" ? "year" : "month";
    const origin = req.headers.get("origin") || "https://lowendcandy.com";

    // Create Stripe Checkout session in subscription mode
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: `CRUX Chords AI Chord Generator – ${interval === "year" ? "Annual" : "Monthly"} subscription`,
            },
            unit_amount: product.price_cents,
            recurring: { interval },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/crux-chords?subscribed=true`,
      cancel_url: `${origin}/crux-chords`,
      metadata: {
        supabase_user_id: user.id,
        site_product_slug: product.slug,
        site: "lowendcandy",
        source_app: "lowendcandy",
        product_type: "crux_chords_subscription",
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          site_product_slug: product.slug,
          site: "lowendcandy",
          source_app: "lowendcandy",
        },
      },
    });

    console.log("Created checkout session:", session.id, "for user:", user.id, "product:", product.slug);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-subscription error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to create checkout session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
