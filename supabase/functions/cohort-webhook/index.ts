import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { Resend } from "npm:resend@2.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("No Stripe signature found");
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log("Cohort webhook event received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Check if this is a cohort subscription
      if (session.metadata?.product_type !== 'cohort_subscription') {
        console.log("Not a cohort subscription, skipping");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const customerEmail = session.metadata?.customer_email || session.customer_email;
      const customerName = session.metadata?.customer_name || 'Unknown';
      const tier = session.metadata?.tier || 'premium';
      const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A';

      console.log("Cohort subscription completed:", { customerEmail, customerName, tier, amountTotal });

      // Send notification email to admin
      const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
      
      if (adminEmail) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Low End Candy <onboarding@resend.dev>",
            to: [adminEmail],
            subject: `🎉 New Cohort Member: ${customerName} (${tier.toUpperCase()})`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #00FFD1; margin-bottom: 20px;">New Cohort Subscription!</h1>
                
                <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                  <h2 style="color: #fff; margin-top: 0;">Member Details</h2>
                  <table style="width: 100%; color: #ccc;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Name:</td>
                      <td style="padding: 8px 0;">${customerName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                      <td style="padding: 8px 0;">${customerEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Tier:</td>
                      <td style="padding: 8px 0; color: #00FFD1;">${tier.toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Amount:</td>
                      <td style="padding: 8px 0;">$${amountTotal}/month</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                      <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="color: #888; font-size: 14px;">
                  <strong>Action Required:</strong> Add this member to the Skool community with ${tier} access.
                </p>
                
                <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
                
                <p style="color: #666; font-size: 12px;">
                  This notification was sent from Low End Candy Collective.
                </p>
              </div>
            `,
          });

          console.log("Admin notification email sent:", emailResponse);
        } catch (emailError) {
          console.error("Failed to send admin notification email:", emailError);
          // Don't fail the webhook if email fails
        }
      } else {
        console.warn("ADMIN_NOTIFICATION_EMAIL not configured, skipping notification");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Cohort webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    );
  }
});
