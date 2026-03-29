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
const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "beau@lowendcandy.com";
const EXPECTED_SOURCE_APP = "lowendcandy_store";
const EXPECTED_SITE = "lowendcandy";

// Send alert email to admin when delivery fails
async function sendAdminAlert(subject: string, details: string) {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not set, cannot send admin alert");
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Low End Candy Alerts <beau@lowendcandy.com>",
        to: [ADMIN_EMAIL],
        subject: `🚨 ${subject}`,
        html: `<h2>⚠️ Delivery Alert</h2><p>${details}</p><p>Check the <a href="https://supabase.com/dashboard/project/ocydkbblpnshbvkilngl/functions/stripe-webhook/logs">webhook logs</a> and <a href="https://supabase.com/dashboard/project/ocydkbblpnshbvkilngl/functions/send-purchase-email/logs">email logs</a> for details.</p><p>You can resend the email from the admin dashboard or by calling the resend-purchase-email edge function.</p>`,
      }),
    });
    if (res.ok) {
      console.log("Admin alert sent:", subject);
    } else {
      console.error("Failed to send admin alert:", await res.text());
    }
  } catch (e) {
    console.error("Admin alert error:", e);
  }
}

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

function parsePriceToCents(price: string | null | undefined): number | null {
  if (!price) return null;
  const normalized = price.trim().toLowerCase();
  if (normalized === 'free') return 0;
  const numeric = parseFloat(normalized.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(numeric)) return null;
  return Math.round(numeric * 100);
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
      
      let productTitle = paymentIntent.metadata?.product_title || "Digital Product";
      const productId = paymentIntent.metadata?.product_id;
      const customerFirstName = paymentIntent.metadata?.customer_first_name || "";
      const customerLastName = paymentIntent.metadata?.customer_last_name || "";
      const amount = paymentIntent.amount / 100;
      const sourceApp = paymentIntent.metadata?.source_app || "";
      const site = paymentIntent.metadata?.site || "";

      console.log("Recording purchase for:", email, "Amount:", amount);

      // Ignore payments not explicitly created by this storefront to prevent cross-app misdelivery
      if (sourceApp !== EXPECTED_SOURCE_APP || site !== EXPECTED_SITE) {
        console.warn("Ignoring payment from unexpected source", {
          paymentIntentId: paymentIntent.id,
          sourceApp,
          site,
          productId,
          email,
        });
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "source_mismatch" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (!email || !productId) {
        console.error("Missing email or productId!", { email, productId, paymentIntentId: paymentIntent.id });
        await sendAdminAlert(
          "Payment Missing Email or Product ID",
          `A payment of $${amount} succeeded (${paymentIntent.id}) but ${!email ? 'customer email' : 'product ID'} is missing. Product: ${productTitle}. This customer will NOT receive their download. Check Stripe dashboard for details.`
        );
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "missing_required_metadata" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Idempotency guard for duplicate Stripe webhook deliveries
      const { data: existingPurchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('stripe_payment_id', paymentIntent.id)
        .maybeSingle();

      if (existingPurchase) {
        console.log("Payment already processed, skipping duplicate delivery:", paymentIntent.id);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Canonical product lookup so delivery always maps from DB product_id
      const { data: catalogProduct, error: catalogProductError } = await supabase
        .from('products')
        .select('id, title, price')
        .eq('id', productId)
        .maybeSingle();

      if (catalogProductError || !catalogProduct) {
        console.error("Product lookup failed for webhook delivery", {
          productId,
          paymentIntentId: paymentIntent.id,
          error: catalogProductError,
        });
        await sendAdminAlert(
          "Webhook Product Lookup Failed",
          `Payment ${paymentIntent.id} could not be matched to a valid product row for product_id <strong>${productId}</strong>. Delivery was intentionally blocked to prevent wrong-product emails.`
        );
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "unknown_product" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      productTitle = catalogProduct.title;

      const expectedCents = parsePriceToCents(catalogProduct.price);
      if (expectedCents !== null && expectedCents !== paymentIntent.amount) {
        console.warn("Amount differs from catalog price (coupon/discount likely)", {
          paymentIntentId: paymentIntent.id,
          productId,
          expectedCents,
          chargedCents: paymentIntent.amount,
        });
      }

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

        // Check if this is a lesson booking
        const isLesson = paymentIntent.metadata?.is_lesson === 'true';
        const lessonDate = paymentIntent.metadata?.lesson_date;
        const lessonTime = paymentIntent.metadata?.lesson_time;

        // Only send download email for non-lesson products
        if (!isLesson) {
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
              user_id: profile?.id || null,
              expires_at: expiresAt.toISOString(),
              max_downloads: 5
            });

          if (tokenError) {
            console.error("Error creating download token:", tokenError);
            await sendAdminAlert(
              "Download Token Creation Failed",
              `Failed to create download token for <strong>${email}</strong> who purchased <strong>${productTitle}</strong> ($${amount}). Payment ID: ${paymentIntent.id}. Error: ${JSON.stringify(tokenError)}`
            );
          } else {
            console.log("Download token created successfully, expires:", expiresAt.toISOString());
            console.log("Sending purchase email to:", email);

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
              console.error("Error sending purchase email:", emailError);
              await sendAdminAlert(
                "Purchase Email Delivery Failed",
                `Failed to send purchase email to <strong>${email}</strong> for <strong>${productTitle}</strong> ($${amount}). Payment ID: ${paymentIntent.id}. Error: ${emailError.message || JSON.stringify(emailError)}. The customer paid but did NOT receive their download link. Use the resend-purchase-email function to manually deliver.`
              );
            } else {
              console.log("Purchase email sent successfully");
            }
          }
        }

        // Send lesson notification for lesson bookings
        if (isLesson && lessonDate && lessonTime) {
          // Calculate duration from product title
          let durationMinutes = 60; // default
          if (productTitle.includes('2 Hour')) {
            durationMinutes = 120;
          } else if (productTitle.includes('4 Lesson')) {
            durationMinutes = 60; // First session is 1 hour
          }
          
          // Generate cancellation token for the lesson
          const cancellationToken = crypto.randomUUID() + '-' + Date.now().toString(36);
          
          // Record the lesson booking
          const { error: bookingError } = await supabase
            .from('lesson_bookings')
            .insert({
              customer_email: email,
              customer_first_name: customerFirstName || null,
              customer_last_name: customerLastName || null,
              product_id: productId,
              product_title: productTitle,
              lesson_date: lessonDate,
              lesson_time: lessonTime,
              duration_minutes: durationMinutes,
              amount_paid: paymentIntent.amount,
              stripe_payment_id: paymentIntent.id,
              cancellation_token: cancellationToken,
              status: 'confirmed',
            });

          if (bookingError) {
            console.error("Error recording lesson booking:", bookingError);
          } else {
            console.log("Lesson booking recorded successfully");
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
              cancellationToken: cancellationToken,
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
    // Alert admin on complete webhook failure
    await sendAdminAlert(
      "Stripe Webhook CRASHED",
      `The webhook handler threw an unhandled error: <strong>${error.message}</strong>. This means a payment may have been received but NOT processed at all. Check logs immediately.`
    );
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }), 
      {
        headers: { "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
