import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/9568sygekt6l2vvyjbtvamhd1ptuim46";

// Send purchase data to Make.com
async function sendToMake(purchaseData: {
  email: string;
  firstName?: string;
  lastName?: string;
  productTitle: string;
  amount: number;
  purchaseDate: string;
  paymentId: string;
}) {
  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: purchaseData.email,
        first_name: purchaseData.firstName || "",
        last_name: purchaseData.lastName || "",
        product_title: purchaseData.productTitle,
        amount_paid: purchaseData.amount,
        purchase_date: purchaseData.purchaseDate,
        stripe_payment_id: purchaseData.paymentId,
        source: "bohemyth_store",
      }),
    });
    
    if (!response.ok) {
      console.error("Make.com webhook failed:", response.status, await response.text());
    } else {
      console.log("Make.com webhook sent successfully for:", purchaseData.email);
    }
  } catch (error) {
    console.error("Error sending to Make.com:", error);
  }
}

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
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

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
      const customerFirstName = paymentIntent.metadata?.customer_first_name || "";
      const customerLastName = paymentIntent.metadata?.customer_last_name || "";
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

        // Send to Make.com webhook with first/last name
        await sendToMake({
          email: email,
          firstName: customerFirstName,
          lastName: customerLastName,
          productTitle: productTitle,
          amount: amount,
          purchaseDate: new Date().toISOString(),
          paymentId: paymentIntent.id,
        });

        // Generate secure download token (7-day expiry, 5 downloads max)
        const downloadToken = crypto.randomUUID() + '-' + Date.now().toString(36);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        const { error: tokenError } = await supabase
          .from('download_tokens')
          .insert({
            token: downloadToken,
            product_id: productId,
            customer_email: email,
            expires_at: expiresAt.toISOString(),
            max_downloads: 5
          });

        if (tokenError) {
          console.error("Error creating download token:", tokenError);
          // Continue anyway to send email with fallback
        } else {
          console.log("Download token created successfully, expires:", expiresAt.toISOString());
        }

        console.log("Sending email to:", email);

        // Call the send-purchase-email function with secure download token
        const { error: emailError } = await supabase.functions.invoke("send-purchase-email", {
          body: {
            to: email,
            productTitle: productTitle,
            amount: amount,
            paymentIntentId: paymentIntent.id,
            productId: productId,
            downloadToken: downloadToken,
          },
        });

        if (emailError) {
          console.error("Error sending email:", emailError);
        } else {
          console.log("Purchase email sent successfully");
        }

        // Check if this is a lesson booking and send notification to instructor
        const isLesson = paymentIntent.metadata?.is_lesson === 'true';
        if (isLesson) {
          const lessonDate = paymentIntent.metadata?.lesson_date;
          const lessonTime = paymentIntent.metadata?.lesson_time;
          
          // Calculate duration from product title
          let durationMinutes = 60; // default
          if (productTitle.includes('2 Hour')) {
            durationMinutes = 120;
          } else if (productTitle.includes('4 Lesson')) {
            durationMinutes = 60; // First session is 1 hour
          }
          
          console.log("Sending lesson notification for:", { productTitle, lessonDate, lessonTime });
          
          const { error: lessonEmailError } = await supabase.functions.invoke("send-lesson-notification", {
            body: {
              customerEmail: email,
              lessonTitle: productTitle,
              lessonDate: lessonDate,
              lessonTime: lessonTime,
              durationMinutes: durationMinutes,
              amountPaid: amount,
            },
          });

          if (lessonEmailError) {
            console.error("Error sending lesson notification:", lessonEmailError);
          } else {
            console.log("Lesson notification email sent successfully");
          }
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
