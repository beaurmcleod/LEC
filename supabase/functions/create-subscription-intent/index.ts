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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { product_slug, customerFirstName, customerLastName } = await req.json();
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

    // Create a Stripe Price (or use an existing one)
    // For simplicity, create an inline price via the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              metadata: {
                site_product_slug: product.slug,
                site: "lowendcandy",
              },
            },
            unit_amount: product.price_cents,
            recurring: { interval },
          },
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        supabase_user_id: user.id,
        site_product_slug: product.slug,
        site: "lowendcandy",
        source_app: "lowendcandy",
        product_type: "crux_chords_subscription",
        customer_first_name: customerFirstName || "",
        customer_last_name: customerLastName || "",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent as any;

    if (!paymentIntent?.client_secret) {
      console.error("No client_secret from subscription", subscription.id);
      return new Response(
        JSON.stringify({ error: "Failed to initialize payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Created subscription:", subscription.id, "PI:", paymentIntent.id, "for user:", user.id);

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      subscription_id: subscription.id,
      amount: product.price_cents,
      currency: "usd",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-subscription-intent error:", error);
    return new Response(
      JSON.stringify({ error: "Unable to create subscription checkout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
