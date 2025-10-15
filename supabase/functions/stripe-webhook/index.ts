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
    
    // Verify the webhook signature
    const event = webhookSecret
      ? stripe.webhooks.constructEvent(body, signature, webhookSecret)
      : JSON.parse(body);

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
        const { error: purchaseError } = await supabase
          .from('purchases')
          .insert({
            product_id: productId,
            stripe_payment_id: paymentIntent.id,
            amount_paid: paymentIntent.amount,
            customer_email: email,
          });

        if (purchaseError) {
          console.error("Error recording purchase:", purchaseError);
          // Continue anyway to send email
        } else {
          console.log("Purchase recorded successfully");
        }
      }

      console.log("Sending email to:", email);

      // Call the send-purchase-email function
      const { error: emailError } = await supabase.functions.invoke("send-purchase-email", {
        body: {
          to: email,
          productTitle: productTitle,
          amount: amount,
          paymentIntentId: paymentIntent.id,
        },
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
      } else {
        console.log("Purchase email sent successfully");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
