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

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log("Cohort webhook event received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Check if this is a cohort membership
      if (session.metadata?.product_type !== 'cohort_membership') {
        console.log("Not a cohort membership, skipping");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const customerEmail = session.metadata?.customer_email || session.customer_email;
      const customerName = session.metadata?.customer_name || 'Unknown';
      const tier = session.metadata?.tier || 'premium';
      const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A';

      console.log("Cohort subscription completed:", { customerEmail, customerName, tier, amountTotal });

      const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";

      // Send confirmation email to customer
      if (customerEmail) {
        try {
          const customerEmailResponse = await resend.emails.send({
            from: "Low End Candy <noreply@lowendcandy.com>",
            to: [customerEmail],
            subject: `Welcome to the Low End Candy Collective! 🎉`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fff;">
                <h1 style="color: #00FFD1; margin-bottom: 20px;">Thank You for Joining!</h1>
                
                <p style="color: #ccc; font-size: 16px; line-height: 1.6;">
                  Hey ${customerName}! 👋
                </p>
                
                <p style="color: #ccc; font-size: 16px; line-height: 1.6;">
                  Thank you for joining the Low End Candy Collective! We're excited to have you on this journey to becoming a better producer.
                </p>
                
                <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #00FFD1;">
                  <p style="color: #fff; margin: 0 0 12px 0; font-weight: bold;">⏰ Please allow up to 3 hours for access</p>
                  <p style="color: #888; margin: 0; font-size: 14px;">
                    Every membership needs to be manually approved per Skool's spam guidelines. You'll receive access to the community shortly!
                  </p>
                </div>
                
                <p style="color: #ccc; font-size: 16px; line-height: 1.6;">
                  Once approved, you can access the community here:
                </p>
                
                <a href="${SKOOL_URL}" style="display: inline-block; background: #00FFD1; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
                  Go to Skool Community →
                </a>
                
                <p style="color: #888; font-size: 14px; margin-top: 32px;">
                  Questions? Reply to this email or reach out at support@lowendcandy.com
                </p>
                
                <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
                
                <p style="color: #666; font-size: 12px;">
                  Low End Candy Collective - ${tier.toUpperCase()} Membership
                </p>
              </div>
            `,
          });

          console.log("Customer confirmation email sent:", customerEmailResponse);
        } catch (emailError) {
          console.error("Failed to send customer confirmation email:", emailError);
        }
      }

      // Send notification email to admin
      const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
      
      if (adminEmail) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Low End Candy <noreply@lowendcandy.com>",
            to: [adminEmail],
            subject: `🎉 New Cohort Member: ${customerName} (${tier.toUpperCase()})`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #00FFD1; margin-bottom: 20px;">New Cohort Membership!</h1>
                
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
                      <td style="padding: 8px 0;">$${amountTotal}</td>
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
