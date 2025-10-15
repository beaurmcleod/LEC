import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  
  if (!signature) {
    console.error("No signature provided");
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    // SECURITY: Webhook signature verification is mandatory
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: 'Webhook configuration error' }), 
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    
    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log("Webhook event received:", event.type);

    // Handle successful payment
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      console.log("Payment succeeded:", paymentIntent.id);

      // Get customer email from payment intent
      const email = paymentIntent.receipt_email || 
                    (paymentIntent.charges?.data[0]?.billing_details?.email);
      
      const productTitle = paymentIntent.metadata?.product_title || "Digital Product";
      const productId = paymentIntent.metadata?.product_id;
      const amount = paymentIntent.amount / 100;

      console.log("Recording purchase for:", email);

      // SECURITY: Record purchase in database for verification
      if (productId && email) {
        // Check if user exists with this email
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        const { error: purchaseError } = await supabase
          .from('purchases')
          .insert({
            product_id: productId,
            stripe_payment_id: paymentIntent.id,
            amount_paid: paymentIntent.amount,
            customer_email: email,
            user_id: profile?.id || null, // Link to user if they have an account
          });

        if (purchaseError) {
          console.error("Error recording purchase:", purchaseError);
          // Continue anyway to send email
        } else {
          console.log("Purchase recorded successfully", profile?.id ? 'with user_id' : 'without user_id');
        }

        // Fetch product download URL for email
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('download_url')
          .eq('id', productId)
          .single();

        if (productError) {
          console.error("Error fetching product:", productError);
        }

        const downloadUrl = product?.download_url || '';

        console.log("Sending email to:", email);

        // Call the send-purchase-email function with download link
        const { error: emailError } = await supabase.functions.invoke("send-purchase-email", {
          body: {
            to: email,
            productTitle: productTitle,
            amount: amount,
            paymentIntentId: paymentIntent.id,
            productId: productId,
            downloadUrl: downloadUrl,
          },
        });

        if (emailError) {
          console.error("Error sending email:", emailError);
        } else {
          console.log("Purchase email sent successfully");
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }), 
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
