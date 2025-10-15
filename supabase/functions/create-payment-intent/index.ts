import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Payment intent request received');
    const body = await req.json();
    
    // Input validation with zod
    const paymentSchema = z.object({
      productId: z.string().uuid({ message: "Invalid product ID format" }),
      customerEmail: z.string().email().max(255).optional()
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

    const { productId, customerEmail } = validation.data;

    // SECURITY: Fetch actual price from database instead of trusting client
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('price, title')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      throw new Error("Product not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Convert database price to cents
    const priceInCents = Math.round(parseFloat(product.price.replace('$', '')) * 100);

    console.log('Creating payment intent for product:', product.title, 'amount:', priceInCents);
    
    // Create a payment intent for embedded checkout
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceInCents,
      currency: "usd",
      description: `${product.title} - Digital music production content`,
      receipt_email: customerEmail || undefined,
      metadata: {
        product_id: productId,
        product_title: product.title,
      },
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