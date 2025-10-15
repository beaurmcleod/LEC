import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseEmailRequest {
  to: string;
  productTitle: string;
  amount: number;
  paymentIntentId: string;
  productId: string;
  downloadUrl: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, productTitle, amount, paymentIntentId, productId, downloadUrl }: PurchaseEmailRequest = await req.json();

    console.log("Sending purchase email to:", to);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-radius: 0 0 10px 10px;
            }
            .product-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .download-button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              color: #999;
              font-size: 12px;
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Thank You for Your Purchase! 🎉</h1>
          </div>
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
              <strong>Note:</strong> This download link is unique to your purchase. 
              Please save this email for future reference.
            </p>

            <p>If you have any questions or need support, please don't hesitate to reach out.</p>

            <p>Happy creating!</p>
          </div>
          <div class="footer">
            <p>This email was sent because you made a purchase on our store.</p>
            <p>If you didn't make this purchase, please contact us immediately.</p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Low End Candy <beau@lowendcandy.com>",
      to: [to],
      subject: `Your Purchase Confirmation - ${productTitle}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error sending purchase email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
