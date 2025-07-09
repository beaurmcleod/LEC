import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productTitle, price, productId } = await req.json();
    
    if (!productTitle || !price) {
      throw new Error("Product title and price are required");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Convert price string to cents (e.g., "$24.99" to 2499)
    const priceInCents = Math.round(parseFloat(price.replace('$', '')) * 100);

    // Create a payment intent for embedded checkout
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInCents,
      currency: "usd",
      description: `${productTitle} - Digital music production content`,
      metadata: {
        product_id: productId || productTitle,
        product_title: productTitle,
      },
    });

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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});