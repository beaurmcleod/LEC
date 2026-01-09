import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    console.log("Sending test email to:", email);

    const emailResponse = await resend.emails.send({
      from: "Lovable <onboarding@resend.dev>",
      to: [email],
      subject: "Test Email - Resend Default Sender",
      html: `
        <h1>Test Email</h1>
        <p>This is a test email sent using Resend's default sender (onboarding@resend.dev).</p>
        <p>If you receive this but not the purchase emails, there may be a filtering issue with your domain.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });

    console.log("Email response:", emailResponse);

    return new Response(JSON.stringify({ success: true, response: emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
