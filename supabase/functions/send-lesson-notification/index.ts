import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

// Zoom link for lessons
const ZOOM_LINK = "https://csuchico.zoom.us/j/2955509906?pwd=lDhqbg9vVBaAAmedSq1b8FRN8gbpKz.1";

const requestSchema = z.object({
  customerEmail: z.string().email(),
  lessonTitle: z.string(),
  lessonDate: z.string(),
  lessonTime: z.string(),
  durationMinutes: z.number(),
  amountPaid: z.number(),
  isFree: z.boolean().optional(),
  cancellationToken: z.string().optional(),
});

function generateICSFile(
  title: string,
  startDate: Date,
  durationMinutes: number,
  customerEmail: string,
  isCustomerVersion: boolean = false
): string {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const uid = `${Date.now()}-lesson-${isCustomerVersion ? 'customer' : 'beau'}@lecproductions.com`;
  const summary = isCustomerVersion 
    ? `Music Production Lesson with LEC Productions` 
    : `${title} - ${customerEmail}`;
  const description = isCustomerVersion
    ? `Your music production lesson with Beau from LEC Productions.\\n\\nJoin via Zoom: ${ZOOM_LINK}\\n\\nLooking forward to seeing you!`
    : `Music production lesson with ${customerEmail}\\n\\nZoom Link: ${ZOOM_LINK}`;
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LEC Productions//Lesson Booking//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:Zoom Meeting
URL:${ZOOM_LINK}
STATUS:CONFIRMED
ORGANIZER;CN=LEC Productions:mailto:beaurmcleod@gmail.com
ATTENDEE;CN=Student:mailto:${customerEmail}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Lesson starting in 1 hour
TRIGGER:-PT1H
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Lesson starting in 15 minutes
TRIGGER:-PT15M
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

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
  
  date.setUTCHours(hours + 8, minutes, 0, 0);
  
  return date;
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate instructor email HTML with LEC branding
function generateInstructorEmailHTML(data: {
  customerEmail: string;
  lessonTitle: string;
  displayDate: string;
  lessonTime: string;
  durationMinutes: number;
  amountPaid: number;
  isFree: boolean;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${LEC_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.background}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.2);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: ${LEC_COLORS.text}; font-size: 28px; font-weight: bold;">🎹 New Lesson Booked!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="color: ${LEC_COLORS.text}; font-size: 16px; margin: 0 0 24px 0;">
                    Hey Beau! You have a new lesson booking${data.isFree ? ' (FREE with coupon)' : ''}:
                  </p>
                  
                  <!-- Details Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                    <tr>
                      <td style="padding: 24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Student Email:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 18px; font-weight: 600;">${data.customerEmail}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Lesson:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.lessonTitle}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Date & Time:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.displayDate} at ${data.lessonTime} PST</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Duration:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.durationMinutes} minutes</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Payment:</span>
                              <p style="margin: 4px 0 0 0; color: #10B981; font-size: 18px; font-weight: 600;">${data.isFree ? 'FREE (coupon)' : '$' + data.amountPaid.toFixed(2)}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Zoom Link Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                    <tr>
                      <td align="center">
                        <a href="${ZOOM_LINK}" style="display: inline-block; background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); color: ${LEC_COLORS.text}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          🎥 Join Zoom Meeting
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: ${LEC_COLORS.textMuted}; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                    Calendar invite attached with all the details.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
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
}

// Generate customer email HTML with LEC branding
function generateCustomerEmailHTML(data: {
  lessonTitle: string;
  displayDate: string;
  lessonTime: string;
  durationMinutes: number;
  cancellationToken?: string;
}): string {
  const siteUrl = "https://low-end-beats-boutique.lovable.app";
  const cancelUrl = data.cancellationToken ? `${siteUrl}/cancel-lesson?token=${data.cancellationToken}` : null;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${LEC_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.background}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${LEC_COLORS.cardBg}; border-radius: 16px; overflow: hidden; border: 1px solid rgba(139, 92, 246, 0.2);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: ${LEC_COLORS.text}; font-size: 28px; font-weight: bold;">🎹 Lesson Confirmed!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="color: ${LEC_COLORS.text}; font-size: 18px; margin: 0 0 8px 0;">
                    Hey there! 👋
                  </p>
                  <p style="color: ${LEC_COLORS.textMuted}; font-size: 16px; margin: 0 0 24px 0;">
                    Your lesson has been booked! Here are the details:
                  </p>
                  
                  <!-- Details Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(139, 92, 246, 0.1); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3);">
                    <tr>
                      <td style="padding: 24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Lesson:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 18px; font-weight: 600;">${data.lessonTitle}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Date:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.displayDate}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Time:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.lessonTime} PST</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;">
                              <span style="color: ${LEC_COLORS.textMuted}; font-size: 14px;">Duration:</span>
                              <p style="margin: 4px 0 0 0; color: ${LEC_COLORS.text}; font-size: 16px;">${data.durationMinutes} minutes</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Zoom Link Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                    <tr>
                      <td align="center">
                        <a href="${ZOOM_LINK}" style="display: inline-block; background: linear-gradient(135deg, ${LEC_COLORS.primary}, ${LEC_COLORS.primaryDark}); color: ${LEC_COLORS.text}; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          🎥 Join Zoom Meeting
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: ${LEC_COLORS.textMuted}; font-size: 14px; margin: 24px 0 0 0; text-align: center;">
                    A calendar invite is attached. You'll receive a reminder 1 hour before your lesson.
                  </p>
                  
                  <!-- What to prepare -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; background-color: rgba(245, 158, 11, 0.1); border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.3);">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 12px 0; color: ${LEC_COLORS.accent}; font-size: 14px; font-weight: 600;">💡 BEFORE YOUR LESSON:</p>
                        <ul style="margin: 0; padding-left: 20px; color: ${LEC_COLORS.textMuted}; font-size: 14px;">
                          <li style="margin-bottom: 8px;">Have your DAW open and ready</li>
                          <li style="margin-bottom: 8px;">Test your audio/mic setup</li>
                          <li style="margin-bottom: 8px;">Prepare any questions or projects to discuss</li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Cancellation Notice -->
              ${cancelUrl ? `
              <tr>
                <td style="padding: 0 40px 24px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
                    <tr>
                      <td style="padding: 16px; text-align: center;">
                        <p style="margin: 0 0 8px 0; color: ${LEC_COLORS.textMuted}; font-size: 12px;">
                          Need to cancel? You can cancel up to 24 hours before your lesson.
                        </p>
                        <a href="${cancelUrl}" style="color: #EF4444; font-size: 12px; text-decoration: underline;">
                          Cancel this lesson
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ` : ''}
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px; text-align: center; border-top: 1px solid rgba(139, 92, 246, 0.2);">
                  <p style="margin: 0 0 8px 0; color: ${LEC_COLORS.text}; font-size: 14px;">
                    Questions? Reply to this email or reach out to <a href="mailto:beaurmcleod@gmail.com" style="color: ${LEC_COLORS.primary};">beaurmcleod@gmail.com</a>
                  </p>
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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Received lesson notification request:", body);

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error("Validation error:", validation.error);
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { customerEmail, lessonTitle, lessonDate, lessonTime, durationMinutes, amountPaid, isFree, cancellationToken } = validation.data;

    // Parse the date and time
    const startDate = parseTimeToDate(lessonDate, lessonTime);
    const displayDate = formatDisplayDate(lessonDate);
    
    // Generate ICS file content with Zoom link
    const icsContentBeau = generateICSFile(lessonTitle, startDate, durationMinutes, customerEmail, false);
    const icsContentCustomer = generateICSFile(lessonTitle, startDate, durationMinutes, customerEmail, true);
    const icsBase64Beau = btoa(icsContentBeau);
    const icsBase64Customer = btoa(icsContentCustomer);

    // Store lesson reminder in database for 1-hour before notification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate reminder time (1 hour before lesson)
    const reminderTime = new Date(startDate.getTime() - 60 * 60 * 1000);
    
    console.log("Storing lesson reminder for:", reminderTime.toISOString());
    
    const { error: insertError } = await supabase
      .from('lesson_reminders')
      .insert({
        customer_email: customerEmail,
        lesson_title: lessonTitle,
        lesson_date: lessonDate,
        lesson_time: lessonTime,
        duration_minutes: durationMinutes,
        lesson_start_utc: startDate.toISOString(),
        reminder_time: reminderTime.toISOString(),
        reminder_sent: false,
      });

    if (insertError) {
      console.error("Failed to store lesson reminder:", insertError);
      // Continue anyway - confirmation emails are more important
    } else {
      console.log("Lesson reminder stored successfully");
    }

    // Generate email HTML
    const beauEmailHtml = generateInstructorEmailHTML({
      customerEmail,
      lessonTitle,
      displayDate,
      lessonTime,
      durationMinutes,
      amountPaid,
      isFree: isFree || false,
    });

    const customerEmailHtml = generateCustomerEmailHTML({
      lessonTitle,
      displayDate,
      lessonTime,
      durationMinutes,
      cancellationToken,
    });

    console.log("Sending lesson notification emails...");

    // Send both emails
    const [beauEmailResponse, customerEmailResponse] = await Promise.all([
      resend.emails.send({
        from: "LEC Productions <onboarding@resend.dev>",
        to: ["beaurmcleod@gmail.com"],
        subject: `🎹 New Lesson Booked: ${lessonTitle} - ${displayDate} ${lessonTime}`,
        html: beauEmailHtml,
        attachments: [
          {
            filename: "lesson-booking.ics",
            content: icsBase64Beau,
            content_type: "text/calendar",
          },
        ],
      }),
      resend.emails.send({
        from: "LEC Productions <onboarding@resend.dev>",
        to: [customerEmail],
        subject: `🎹 Your Lesson is Confirmed! - ${displayDate} ${lessonTime} PST`,
        html: customerEmailHtml,
        attachments: [
          {
            filename: "lesson-invite.ics",
            content: icsBase64Customer,
            content_type: "text/calendar",
          },
        ],
      }),
    ]);

    console.log("Emails sent successfully:", { beauEmailResponse, customerEmailResponse });

    return new Response(JSON.stringify({ 
      success: true, 
      beauEmail: beauEmailResponse,
      customerEmail: customerEmailResponse,
      reminderScheduled: !insertError,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error sending lesson notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send lesson notification", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
