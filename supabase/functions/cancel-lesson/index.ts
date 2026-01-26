import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// LEC Brand Colors
const LEC_COLORS = {
  primary: "#8B5CF6",
  primaryDark: "#7C3AED",
  background: "#0D0D0D",
  cardBg: "#1A1A2E",
  text: "#FFFFFF",
  textMuted: "#A0A0A0",
  accent: "#F59E0B",
  error: "#EF4444",
};

const requestSchema = z.object({
  token: z.string().min(32).max(255),
});

function parseTimeToDate(dateStr: string, timeStr: string): Date {
  const date = new Date(dateStr);
  
  const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeParts) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  
  let hours = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);
  const isPM = timeParts[3].toUpperCase() === 'PM';
  
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  
  // Convert PST to UTC (add 8 hours)
  date.setUTCHours(hours + 8, minutes, 0, 0);
  
  return date;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Cancel lesson request received");

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error("Validation error:", validation.error);
      return new Response(
        JSON.stringify({ error: "Invalid cancellation token format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = validation.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the booking by cancellation token
    const { data: booking, error: fetchError } = await supabase
      .from('lesson_bookings')
      .select('*')
      .eq('cancellation_token', token)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching booking:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to find booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found or already cancelled" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: "This lesson has already been cancelled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if within 24 hours of lesson
    const lessonStart = parseTimeToDate(booking.lesson_date, booking.lesson_time);
    const now = new Date();
    const hoursUntilLesson = (lessonStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilLesson < 24) {
      return new Response(
        JSON.stringify({ 
          error: "Cancellations must be made at least 24 hours before the lesson",
          hoursRemaining: Math.max(0, hoursUntilLesson).toFixed(1)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from('lesson_bookings')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error("Error updating booking:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to cancel booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also delete the lesson reminder if it exists
    await supabase
      .from('lesson_reminders')
      .delete()
      .eq('customer_email', booking.customer_email)
      .eq('lesson_date', booking.lesson_date)
      .eq('lesson_time', booking.lesson_time);

    console.log("Booking cancelled successfully:", booking.id);

    // Format display date
    const displayDate = new Date(booking.lesson_date + 'T12:00:00').toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Send cancellation notification to instructor
    const instructorEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: ${LEC_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.background}; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid ${LEC_COLORS.error}40;">
                <tr>
                  <td style="background: linear-gradient(135deg, ${LEC_COLORS.error}, #DC2626); padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: ${LEC_COLORS.text}; font-size: 28px; font-weight: bold;">❌ Lesson Cancelled</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="color: ${LEC_COLORS.text}; font-size: 16px; margin: 0 0 24px 0;">
                      A student has cancelled their lesson:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                      <tr>
                        <td style="padding: 24px;">
                          <p style="margin: 0 0 12px 0; color: ${LEC_COLORS.textMuted}; font-size: 14px;">Student Email:</p>
                          <p style="margin: 0 0 16px 0; color: ${LEC_COLORS.text}; font-size: 18px; font-weight: 600;">${booking.customer_email}</p>
                          <p style="margin: 0 0 12px 0; color: ${LEC_COLORS.textMuted}; font-size: 14px;">Lesson:</p>
                          <p style="margin: 0 0 16px 0; color: ${LEC_COLORS.text}; font-size: 16px;">${booking.product_title}</p>
                          <p style="margin: 0 0 12px 0; color: ${LEC_COLORS.textMuted}; font-size: 14px;">Was Scheduled For:</p>
                          <p style="margin: 0; color: ${LEC_COLORS.text}; font-size: 16px;">${displayDate} at ${booking.lesson_time} PST</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send confirmation to customer
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: ${LEC_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.background}; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.2);">
                <tr>
                  <td style="background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: ${LEC_COLORS.text}; font-size: 28px; font-weight: bold;">Lesson Cancelled</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="color: ${LEC_COLORS.text}; font-size: 16px; margin: 0 0 24px 0;">
                      Your lesson has been successfully cancelled:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                      <tr>
                        <td style="padding: 24px;">
                          <p style="margin: 0 0 12px 0; color: ${LEC_COLORS.textMuted}; font-size: 14px;">Lesson:</p>
                          <p style="margin: 0 0 16px 0; color: ${LEC_COLORS.text}; font-size: 18px; font-weight: 600;">${booking.product_title}</p>
                          <p style="margin: 0 0 12px 0; color: ${LEC_COLORS.textMuted}; font-size: 14px;">Was Scheduled For:</p>
                          <p style="margin: 0; color: ${LEC_COLORS.text}; font-size: 16px;">${displayDate} at ${booking.lesson_time} PST</p>
                        </td>
                      </tr>
                    </table>
                    <p style="color: ${LEC_COLORS.textMuted}; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                      If you'd like to reschedule, visit <a href="https://low-end-beats-boutique.lovable.app/lessons" style="color: ${LEC_COLORS.primary};">our lesson booking page</a>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.2);">
                    <p style="margin: 0; color: ${LEC_COLORS.textMuted}; font-size: 12px;">
                      LEC Productions • Music Production Lessons
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send both emails
    await Promise.all([
      resend.emails.send({
        from: "LEC Productions <onboarding@resend.dev>",
        to: ["beaurmcleod@gmail.com"],
        subject: `❌ Lesson Cancelled: ${booking.product_title} - ${displayDate}`,
        html: instructorEmailHtml,
      }),
      resend.emails.send({
        from: "LEC Productions <onboarding@resend.dev>",
        to: [booking.customer_email],
        subject: `Your Lesson Has Been Cancelled - ${displayDate}`,
        html: customerEmailHtml,
      }),
    ]);

    console.log("Cancellation emails sent");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Lesson cancelled successfully",
        booking: {
          productTitle: booking.product_title,
          lessonDate: booking.lesson_date,
          lessonTime: booking.lesson_time,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error cancelling lesson:", error);
    return new Response(
      JSON.stringify({ error: "Failed to cancel lesson", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
