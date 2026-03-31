import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logTransaction } from "../_shared/email-helper.ts";

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

async function sendToMake(purchaseData: {
  email: string; firstName?: string; lastName?: string; productId: string; productTitle: string; amount: number; purchaseDate: string; paymentId: string; site: string; sourceApp: string;
}) {
  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: purchaseData.email, first_name: purchaseData.firstName || "", last_name: purchaseData.lastName || "",
        product_id: purchaseData.productId, product_title: purchaseData.productTitle, amount_paid: purchaseData.amount,
        purchase_date: purchaseData.purchaseDate, stripe_payment_id: purchaseData.paymentId,
        site: purchaseData.site, source: purchaseData.sourceApp,
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
  if (normalized === "free") return 0;
  const numeric = parseFloat(normalized.replace(/[^0-9.]/g, ""));
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

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: "Webhook configuration error" }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log("Webhook event received:", event.type);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      console.log("Payment succeeded:", paymentIntent.id);

      const email = paymentIntent.receipt_email || (paymentIntent.charges?.data[0]?.billing_details?.email);
      let productTitle = paymentIntent.metadata?.product_title || "Digital Product";
      const productId = paymentIntent.metadata?.product_id;
      const customerFirstName = paymentIntent.metadata?.customer_first_name || "";
      const customerLastName = paymentIntent.metadata?.customer_last_name || "";
      const amount = paymentIntent.amount / 100;
      const sourceApp = paymentIntent.metadata?.source_app || "";
      const site = paymentIntent.metadata?.site || "";

      console.log("Recording purchase for:", email, "Amount:", amount);

      // Ignore payments not from this storefront
      if (sourceApp !== EXPECTED_SOURCE_APP || site !== EXPECTED_SITE) {
        console.warn("Ignoring payment from unexpected source", { paymentIntentId: paymentIntent.id, sourceApp, site, productId, email });
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "source_mismatch" }), {
          headers: { "Content-Type": "application/json" }, status: 200,
        });
      }

      if (!email || !productId) {
        console.error("Missing email or productId!", { email, productId, paymentIntentId: paymentIntent.id });

        // Log payment failure
        await logTransaction(supabase, {
          site: EXPECTED_SITE,
          eventType: "payment_failed",
          status: "failed",
          customerEmail: email || undefined,
          productId: productId || undefined,
          stripePaymentId: paymentIntent.id,
          edgeFunction: "stripe-webhook",
          errorMessage: `Missing ${!email ? "customer email" : "product ID"}`,
        });

        await sendAdminAlert(
          "Payment Missing Email or Product ID",
          `A payment of $${amount} succeeded (${paymentIntent.id}) but ${!email ? "customer email" : "product ID"} is missing. Product: ${productTitle}. This customer will NOT receive their download. Check Stripe dashboard for details.`,
        );
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "missing_required_metadata" }), {
          headers: { "Content-Type": "application/json" }, status: 200,
        });
      }

      // Idempotency guard
      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("stripe_payment_id", paymentIntent.id)
        .maybeSingle();

      if (existingPurchase) {
        console.log("Payment already processed, skipping duplicate delivery:", paymentIntent.id);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { "Content-Type": "application/json" }, status: 200,
        });
      }

      // Canonical product lookup
      const { data: catalogProduct, error: catalogProductError } = await supabase
        .from("products")
        .select("id, title, price, site")
        .eq("id", productId)
        .maybeSingle();

      if (catalogProductError || !catalogProduct) {
        console.error("Product lookup failed for webhook delivery", { productId, paymentIntentId: paymentIntent.id, error: catalogProductError });

        await logTransaction(supabase, {
          site: EXPECTED_SITE,
          eventType: "payment_failed",
          status: "failed",
          customerEmail: email,
          productId: productId,
          stripePaymentId: paymentIntent.id,
          edgeFunction: "stripe-webhook",
          errorMessage: "Product lookup failed - unknown product ID",
        });

        await sendAdminAlert(
          "Webhook Product Lookup Failed",
          `Payment ${paymentIntent.id} could not be matched to a valid product row for product_id <strong>${productId}</strong>. Delivery was intentionally blocked to prevent wrong-product emails.`,
        );
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "unknown_product" }), {
          headers: { "Content-Type": "application/json" }, status: 200,
        });
      }

      if (catalogProduct.site !== EXPECTED_SITE) {
        console.error("Catalog product site mismatch - delivery blocked", { productId, catalogSite: catalogProduct.site, expectedSite: EXPECTED_SITE, paymentIntentId: paymentIntent.id });

        await logTransaction(supabase, {
          site: EXPECTED_SITE,
          eventType: "payment_failed",
          status: "failed",
          customerEmail: email,
          productId: productId,
          stripePaymentId: paymentIntent.id,
          edgeFunction: "stripe-webhook",
          errorMessage: `Catalog site mismatch: ${catalogProduct.site} vs ${EXPECTED_SITE}`,
        });

        await sendAdminAlert(
          "Blocked Cross-Site Product Delivery",
          `Payment ${paymentIntent.id} resolved to product <strong>${catalogProduct.title}</strong> (${productId}) but catalog site is <strong>${catalogProduct.site}</strong>, expected <strong>${EXPECTED_SITE}</strong>. Delivery was blocked to prevent wrong product fulfillment.`,
        );
        return new Response(JSON.stringify({ received: true, ignored: true, reason: "catalog_site_mismatch" }), {
          headers: { "Content-Type": "application/json" }, status: 200,
        });
      }

      if (paymentIntent.metadata?.product_title && paymentIntent.metadata.product_title !== catalogProduct.title) {
        console.warn("Metadata product title mismatch; using canonical DB title", {
          paymentIntentId: paymentIntent.id, metadataTitle: paymentIntent.metadata.product_title,
          canonicalTitle: catalogProduct.title, productId,
        });
      }

      productTitle = catalogProduct.title;

      const expectedCents = parsePriceToCents(catalogProduct.price);
      if (expectedCents !== null && expectedCents !== paymentIntent.amount) {
        console.warn("Amount differs from catalog price (coupon/discount likely)", {
          paymentIntentId: paymentIntent.id, productId, expectedCents, chargedCents: paymentIntent.amount,
        });
      }

      // Record purchase
      if (productId && email) {
        // Prefer user_id from payment metadata (set during checkout), fall back to profile lookup
        const metadataUserId = paymentIntent.metadata?.user_id;
        let userId = metadataUserId || null;

        if (!userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          userId = profile?.id || null;
        }

        const { error: purchaseError } = await supabase
          .from("purchases")
          .insert({
            product_id: productId,
            stripe_payment_id: paymentIntent.id,
            amount_paid: paymentIntent.amount,
            customer_email: email,
            user_id: userId,
            site: EXPECTED_SITE,
          });

        if (purchaseError) {
          console.error("Error recording purchase:", purchaseError);
        } else {
          console.log("Purchase recorded successfully", userId ? "with user_id" : "without user_id");
        }

        // Log successful payment
        await logTransaction(supabase, {
          site: EXPECTED_SITE,
          eventType: "payment_succeeded",
          status: "success",
          customerEmail: email,
          productId: productId,
          stripePaymentId: paymentIntent.id,
          edgeFunction: "stripe-webhook",
          metadata: { productTitle, amount, customerFirstName, customerLastName },
        });

        // Send to Make.com
        await sendToMake({
          email, firstName: customerFirstName, lastName: customerLastName,
          productId, productTitle, amount,
          purchaseDate: new Date().toISOString(),
          paymentId: paymentIntent.id, site: EXPECTED_SITE, sourceApp: EXPECTED_SOURCE_APP,
        });

        const isLesson = paymentIntent.metadata?.is_lesson === "true";
        const lessonDate = paymentIntent.metadata?.lesson_date;
        const lessonTime = paymentIntent.metadata?.lesson_time;

        if (!isLesson) {
          const downloadToken = crypto.randomUUID() + "-" + Date.now().toString(36);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          const { error: tokenError } = await supabase
            .from("download_tokens")
            .insert({
              token: downloadToken, product_id: productId, customer_email: email,
              user_id: userId, expires_at: expiresAt.toISOString(), max_downloads: 5,
            });

          if (tokenError) {
            console.error("Error creating download token:", tokenError);
            await sendAdminAlert(
              "Download Token Creation Failed",
              `Failed to create download token for <strong>${email}</strong> who purchased <strong>${productTitle}</strong> ($${amount}). Payment ID: ${paymentIntent.id}. Error: ${JSON.stringify(tokenError)}`,
            );
          } else {
            console.log("Download token created successfully, expires:", expiresAt.toISOString());

            const { error: emailError } = await supabase.functions.invoke("send-purchase-email", {
              body: {
                to: email, productTitle, amount,
                paymentIntentId: paymentIntent.id, productId, downloadToken,
              },
            });

            if (emailError) {
              console.error("Error sending purchase email:", emailError);
              await sendAdminAlert(
                "Purchase Email Delivery Failed",
                `Failed to send purchase email to <strong>${email}</strong> for <strong>${productTitle}</strong> ($${amount}). Payment ID: ${paymentIntent.id}. Error: ${emailError.message || JSON.stringify(emailError)}. The customer paid but did NOT receive their download link. Use the resend-purchase-email function to manually deliver.`,
              );
            } else {
              console.log("Purchase email sent successfully");
            }
          }
        }

        if (isLesson && lessonDate && lessonTime) {
          let durationMinutes = 60;
          if (productTitle.includes("2 Hour")) durationMinutes = 120;
          else if (productTitle.includes("4 Lesson")) durationMinutes = 60;

          const cancellationToken = crypto.randomUUID() + "-" + Date.now().toString(36);

          const { error: bookingError } = await supabase
            .from("lesson_bookings")
            .insert({
              customer_email: email, customer_first_name: customerFirstName || null,
              customer_last_name: customerLastName || null, product_id: productId,
              product_title: productTitle, lesson_date: lessonDate, lesson_time: lessonTime,
              duration_minutes: durationMinutes, amount_paid: paymentIntent.amount,
              stripe_payment_id: paymentIntent.id, cancellation_token: cancellationToken, status: "confirmed",
            });

          if (bookingError) console.error("Error recording lesson booking:", bookingError);
          else console.log("Lesson booking recorded successfully");

          const { error: lessonEmailError } = await supabase.functions.invoke("send-lesson-notification", {
            body: {
              customerEmail: email, lessonTitle: productTitle, lessonDate, lessonTime,
              durationMinutes, amountPaid: amount, cancellationToken,
            },
          });

          if (lessonEmailError) console.error("Error sending lesson notification:", lessonEmailError);
          else console.log("Lesson notification email sent successfully");
        }
      }
    }

    // Handle failed payments
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const email = paymentIntent.receipt_email || (paymentIntent.charges?.data[0]?.billing_details?.email);
      const productId = paymentIntent.metadata?.product_id;
      const errorMessage = paymentIntent.last_payment_error?.message || "Unknown payment failure";

      console.error("Payment failed:", paymentIntent.id, errorMessage);

      await logTransaction(supabase, {
        site: EXPECTED_SITE,
        eventType: "payment_failed",
        status: "failed",
        customerEmail: email || undefined,
        productId: productId || undefined,
        stripePaymentId: paymentIntent.id,
        edgeFunction: "stripe-webhook",
        errorMessage,
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }, status: 200,
    });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    await sendAdminAlert(
      "Stripe Webhook CRASHED",
      `The webhook handler threw an unhandled error: <strong>${error.message}</strong>. This means a payment may have been received but NOT processed at all. Check logs immediately.`,
    );
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }
});
