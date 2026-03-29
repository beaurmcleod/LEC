import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailWithFailsafe } from "../_shared/email-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// LEC Brand Colors
const LEC_COLORS = {
  primary: "#8B5CF6",
  primaryDark: "#7C3AED",
  background: "#0D0D0D",
  cardBg: "#1A1A2E",
  text: "#FFFFFF",
  textMuted: "#A0A0A0",
  accent: "#F59E0B",
};

const ZOOM_LINK = "https://csuchico.zoom.us/j/2955509906?pwd=lDhqbg9vVBaAAmedSq1b8FRN8gbpKz.1";

function generateReminderEmailHTML(data: { lessonTitle: string; lessonTime: string; durationMinutes: number; }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: ${LEC_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.background}; padding: 40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.2);">
            <tr><td style="background: linear-gradient(135deg, ${LEC_COLORS.accent}, #D97706); padding: 30px; text-align: center;"><h1 style="margin: 0; color: ${LEC_COLORS.background}; font-size: 28px; font-weight: bold;">⏰ Lesson in 1 Hour!</h1></td></tr>
            <tr><td style="padding: 40px;">
              <p style="color: ${LEC_COLORS.text}; font-size: 18px; margin: 0 0 8px 0;">Hey there! 👋</p>
              <p style="color: ${LEC_COLORS.textMuted}; font-size: 16px; margin: 0 0 24px 0;">Just a friendly reminder - your lesson starts in about an hour!</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                <tr><td style="padding: 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding: 8px 0;"><span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Lesson:</span><p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 18px; font-weight: 600;">${data.lessonTitle}</p></td></tr>
                    <tr><td style="padding: 8px 0;"><span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Time:</span><p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.lessonTime} PST (${data.durationMinutes} min)</p></td></tr>
                  </table>
                </td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;"><tr><td align="center"><a href="${ZOOM_LINK}" style="display: inline-block; background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); color: ${LEC_COLORS.text}; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 18px;">🎥 Join Zoom Now</a></td></tr></table>
              <p style="color: ${LEC_COLORS.textMuted}; font-size: 14px; margin: 24px 0 0 0; text-align: center;">Make sure your DAW is open and you're ready to go! 🎹</p>
            </td></tr>
            <tr><td style="padding: 24px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.2);"><p style="margin: 0; color: ${LEC_COLORS.textMuted}; font-size: 12px;">LEC Productions • Music Production Lessons</p></td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;
}

function generateInstructorReminderHTML(data: { customerEmail: string; lessonTitle: string; lessonTime: string; durationMinutes: number; }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: ${LEC_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.background}; padding: 40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.2);">
            <tr><td style="background: linear-gradient(135deg, ${LEC_COLORS.accent}, #D97706); padding: 30px; text-align: center;"><h1 style="margin: 0; color: ${LEC_COLORS.background}; font-size: 28px; font-weight: bold;">⏰ Lesson in 1 Hour!</h1></td></tr>
            <tr><td style="padding: 40px;">
              <p style="color: ${LEC_COLORS.text}; font-size: 16px; margin: 0 0 24px 0;">Hey Beau! Your lesson with <strong>${data.customerEmail}</strong> starts in about an hour.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                <tr><td style="padding: 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding: 8px 0;"><span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Lesson:</span><p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 18px; font-weight: 600;">${data.lessonTitle}</p></td></tr>
                    <tr><td style="padding: 8px 0;"><span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Time:</span><p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.lessonTime} PST (${data.durationMinutes} min)</p></td></tr>
                  </table>
                </td></tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;"><tr><td align="center"><a href="${ZOOM_LINK}" style="display: inline-block; background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); color: ${LEC_COLORS.text}; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 18px;">🎥 Start Zoom Meeting</a></td></tr></table>
            </td></tr>
            <tr><td style="padding: 24px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.2);"><p style="margin: 0; color: ${LEC_COLORS.textMuted}; font-size: 12px;">LEC Productions • Music Production Lessons</p></td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for lesson reminders to send...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    console.log("Current time:", now.toISOString());

    const { data: reminders, error: fetchError } = await supabase
      .from('lesson_reminders')
      .select('*')
      .eq('reminder_sent', false)
      .lte('reminder_time', now.toISOString())
      .gt('lesson_start_utc', now.toISOString());

    if (fetchError) {
      console.error("Error fetching reminders:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${reminders?.length || 0} reminders to send`);

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No reminders to send", count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results = [];

    for (const reminder of reminders) {
      console.log(`Sending reminder for lesson: ${reminder.lesson_title} to ${reminder.customer_email}`);
      
      try {
        const customerReminderHtml = generateReminderEmailHTML({
          lessonTitle: reminder.lesson_title,
          lessonTime: reminder.lesson_time,
          durationMinutes: reminder.duration_minutes,
        });

        const instructorReminderHtml = generateInstructorReminderHTML({
          customerEmail: reminder.customer_email,
          lessonTitle: reminder.lesson_title,
          lessonTime: reminder.lesson_time,
          durationMinutes: reminder.duration_minutes,
        });

        const [customerResult, instructorResult] = await Promise.all([
          sendEmailWithFailsafe({
            to: reminder.customer_email,
            from: "LEC Productions <beau@lowendcandy.com>",
            subject: `⏰ Reminder: Your Lesson Starts in 1 Hour!`,
            html: customerReminderHtml,
            site: "lowendcandy",
            emailType: "lesson_reminder",
            edgeFunction: "send-lesson-reminders",
          }),
          sendEmailWithFailsafe({
            to: "beaurmcleod@gmail.com",
            from: "LEC Productions <beau@lowendcandy.com>",
            subject: `⏰ Reminder: Lesson with ${reminder.customer_email} in 1 Hour`,
            html: instructorReminderHtml,
            site: "lowendcandy",
            emailType: "lesson_reminder",
            edgeFunction: "send-lesson-reminders",
          }),
        ]);

        console.log("Reminder emails sent:", { customerResult, instructorResult });

        const { error: updateError } = await supabase
          .from('lesson_reminders')
          .update({ reminder_sent: true })
          .eq('id', reminder.id);

        if (updateError) console.error("Error updating reminder status:", updateError);

        results.push({ id: reminder.id, email: reminder.customer_email, success: true });
      } catch (emailError: any) {
        console.error(`Error sending reminder for ${reminder.customer_email}:`, emailError);
        results.push({ id: reminder.id, email: reminder.customer_email, success: false, error: emailError.message });
      }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing reminders:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process reminders", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
