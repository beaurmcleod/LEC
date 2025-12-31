import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    console.warn('Rate limit exceeded for IP:', clientIp);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { customerEmail, customerName, couponCode } = await req.json();
    
    console.log('Free cohort member request:', { customerEmail, customerName, couponCode });

    if (!customerEmail || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: customerEmail, customerName' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate coupon code
    if (couponCode?.toUpperCase() !== 'LEGACYSTUDENT') {
      return new Response(
        JSON.stringify({ error: 'Invalid coupon code for free membership' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";

    // Send confirmation email to customer
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    try {
      const customerEmailResponse = await resend.emails.send({
        from: "Low End Candy <onboarding@resend.dev>",
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
            
            <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #fbbf24;">
              <p style="color: #fbbf24; margin: 0 0 8px 0; font-weight: bold;">🎓 Free Month Applied!</p>
              <p style="color: #888; margin: 0; font-size: 14px;">
                Your LEGACYSTUDENT discount has been applied. Enjoy your first month free!
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
              Low End Candy Collective - PREMIUM Membership (Free Month)
            </p>
          </div>
        `,
      });

      console.log("Customer confirmation email sent:", customerEmailResponse);
    } catch (emailError) {
      console.error("Failed to send customer confirmation email:", emailError);
    }

    // Send notification email to admin
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    
    if (adminEmail) {
      try {
        const emailResponse = await resend.emails.send({
          from: "Low End Candy <onboarding@resend.dev>",
          to: [adminEmail],
          subject: `🎓 Free Cohort Member (LEGACYSTUDENT): ${customerName}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #00FFD1; margin-bottom: 20px;">New Free Cohort Member!</h1>
              
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
                    <td style="padding: 8px 0; color: #00FFD1;">PREMIUM (Free Month)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Coupon:</td>
                    <td style="padding: 8px 0; color: #fbbf24;">LEGACYSTUDENT</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Date:</td>
                    <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #888; font-size: 14px;">
                <strong>Action Required:</strong> Add this member to the Skool community with Premium access (free first month).
              </p>
              
              <p style="color: #fbbf24; font-size: 14px;">
                <strong>Note:</strong> This member used the LEGACYSTUDENT coupon. Remember to charge them next month if they wish to continue.
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
      console.warn("ADMIN_NOTIFICATION_EMAIL not configured");
    }

    console.log('Free cohort member registered successfully:', customerEmail);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Free cohort member error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to process request. Please try again.' }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
