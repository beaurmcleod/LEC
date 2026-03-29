import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sendEmailWithFailsafe } from "../_shared/email-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    const emailSchema = z.object({
      to: z.string().email().max(255),
      productTitle: z.string().min(1).max(500),
      amount: z.number().nonnegative(),
      paymentIntentId: z.string().min(1),
      productId: z.string().uuid(),
      downloadToken: z.string().min(32).max(255)
    });

    const validation = emailSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validation.error.errors.map(e => e.message) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, productTitle, amount, paymentIntentId, productId, downloadToken } = validation.data;
    console.log("Sending purchase email to:", to);

    const siteUrl = "https://low-end-beats-boutique.lovable.app";
    const downloadUrl = `${siteUrl}/download?token=${downloadToken}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
            .product-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .download-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="header"><h1>Thank You for Your Purchase! 🎉</h1></div>
          <div class="content">
            <p>Hi there!</p>
            <p>Thank you for purchasing <strong>${productTitle}</strong>. Your payment has been successfully processed.</p>
            <div class="product-info">
              <h3>Order Details</h3>
              <p><strong>Product:</strong> ${productTitle}</p>
              <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
              <p><strong>Order ID:</strong> ${paymentIntentId}</p>
            </div>
            <p><strong>Your download is ready!</strong></p>
            <p>Click the button below to download your purchase:</p>
            <div style="text-align: center;">
              <a href="${downloadUrl}" class="download-button">Download ${productTitle}</a>
            </div>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              <strong>Important:</strong> This download link expires in 7 days and allows up to 5 downloads. Please save this email for future reference.
            </p>
            <p>If you have any questions or need support, please contact us at <a href="mailto:beau@lowendcandy.com" style="color: #667eea; text-decoration: none;">beau@lowendcandy.com</a></p>
            <p>Happy creating!</p>
          </div>
          <div class="footer">
            <p>This email was sent because you made a purchase on our store.</p>
            <p>If you didn't make this purchase, please contact us immediately at <a href="mailto:beau@lowendcandy.com" style="color: #667eea;">beau@lowendcandy.com</a></p>
          </div>
        </body>
      </html>
    `;

    const result = await sendEmailWithFailsafe({
      to,
      from: "Low End Candy <beau@lowendcandy.com>",
      subject: `Your Purchase Confirmation - ${productTitle}`,
      html: emailHtml,
      site: "lowendcandy",
      emailType: "purchase_confirmation",
      productId,
      stripePaymentId: paymentIntentId,
      edgeFunction: "send-purchase-email",
    });

    if (!result.success) {
      console.error("Email send failed (queued for retry):", result.error);
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error sending purchase email:", error);
    return new Response(
      JSON.stringify({ error: 'Unable to send email. Please contact support if you did not receive your download link.' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
