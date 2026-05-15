import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmailWithFailsafe } from "../_shared/email-helper.ts";
import { escapeHtml } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DJInquiryRequest {
  name: string;
  email: string;
  phone?: string;
  eventDate?: string;
  eventType?: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, eventDate, eventType, message }: DJInquiryRequest = await req.json();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Name, email, and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeEventType = escapeHtml(eventType);
    const safeEventDate = escapeHtml(eventDate);
    const safeMessage = escapeHtml(message);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #9b87f5; padding-bottom: 10px;">New DJ Service Inquiry</h1>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Contact Information</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
          ${phone ? `<p><strong>Phone:</strong> <a href="tel:${safePhone}">${safePhone}</a></p>` : ""}
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Event Details</h2>
          ${eventType ? `<p><strong>Event Type:</strong> ${safeEventType}</p>` : ""}
          ${eventDate ? `<p><strong>Event Date:</strong> ${safeEventDate}</p>` : ""}
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Message</h2>
          <p style="white-space: pre-wrap;">${safeMessage}</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This inquiry was submitted through the LEC DJ Services page at lowendcandy.com/dj
        </p>
      </div>
    `;

    const result = await sendEmailWithFailsafe({
      to: "beau@lowendcandy.com",
      from: "LEC DJ Services <beau@lowendcandy.com>",
      subject: `DJ Inquiry from ${name}${eventType ? ` - ${eventType}` : ""}`,
      html,
      site: "lowendcandy",
      emailType: "dj_inquiry",
      edgeFunction: "send-dj-inquiry",
      replyTo: email,
    });

    console.log("DJ inquiry email result:", result);

    return new Response(JSON.stringify({ success: result.success }), {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-dj-inquiry function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
