import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  customerEmail: z.string().email(),
  lessonTitle: z.string(),
  lessonDate: z.string(), // ISO date string YYYY-MM-DD
  lessonTime: z.string(), // e.g., "10:00 AM"
  durationMinutes: z.number(),
  amountPaid: z.number(),
  isFree: z.boolean().optional(),
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

  const uid = `${Date.now()}-lesson-${isCustomerVersion ? 'customer' : 'beau'}@lowendcandy.com`;
  const summary = isCustomerVersion 
    ? `Music Production Lesson with Low End Candy` 
    : `${title} - ${customerEmail}`;
  const description = isCustomerVersion
    ? `Your music production lesson with Beau from Low End Candy. Get ready to level up your production skills!`
    : `Music production lesson with ${customerEmail}`;
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Low End Candy//Lesson Booking//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${summary}
DESCRIPTION:${description}
STATUS:CONFIRMED
ORGANIZER;CN=Low End Candy:mailto:beau@lowendcandy.com
ATTENDEE;CN=Student:mailto:${customerEmail}
END:VEVENT
END:VCALENDAR`;
}

function parseTimeToDate(dateStr: string, timeStr: string): Date {
  // Parse date like "2024-01-15" and time like "10:00 AM"
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
  
  // Set time in PST (UTC-8)
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

    const { customerEmail, lessonTitle, lessonDate, lessonTime, durationMinutes, amountPaid, isFree } = validation.data;

    // Parse the date and time
    const startDate = parseTimeToDate(lessonDate, lessonTime);
    const displayDate = formatDisplayDate(lessonDate);
    
    // Generate ICS file content for both parties
    const icsContentBeau = generateICSFile(lessonTitle, startDate, durationMinutes, customerEmail, false);
    const icsContentCustomer = generateICSFile(lessonTitle, startDate, durationMinutes, customerEmail, true);
    const icsBase64Beau = btoa(icsContentBeau);
    const icsBase64Customer = btoa(icsContentCustomer);

    // Email to Beau
    console.log("Sending lesson notification to beaurmcleod@gmail.com");

    const beauEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
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
            .lesson-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .highlight {
              color: #c44569;
              font-weight: bold;
            }
            .calendar-btn {
              display: inline-block;
              background: #c44569;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: bold;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎵 New Lesson Booked!</h1>
          </div>
          <div class="content">
            <p>A new lesson has been booked${isFree ? ' (FREE with coupon code)' : ' and paid for'}!</p>
            
            <div class="lesson-info">
              <h3>Lesson Details</h3>
              <p><strong>Customer:</strong> <span class="highlight">${customerEmail}</span></p>
              <p><strong>Package:</strong> ${lessonTitle}</p>
              <p><strong>Date:</strong> ${displayDate}</p>
              <p><strong>Time:</strong> ${lessonTime} PST</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Amount:</strong> ${isFree ? 'FREE (coupon applied)' : '$' + amountPaid.toFixed(2)}</p>
            </div>

            <p><strong>📅 Calendar invite attached!</strong></p>
            <p>Download the .ics file attached to add this lesson to your Apple Calendar.</p>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Don't forget to reach out to the student to confirm any additional details!
            </p>
          </div>
        </body>
      </html>
    `;

    // Email to customer
    const customerEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
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
            .lesson-info {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .highlight {
              color: #c44569;
              font-weight: bold;
            }
            h1 {
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎵 Lesson Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hey there! Your music production lesson is confirmed. I'm excited to work with you!</p>
            
            <div class="lesson-info">
              <h3>Your Lesson Details</h3>
              <p><strong>Session:</strong> <span class="highlight">${lessonTitle}</span></p>
              <p><strong>Date:</strong> ${displayDate}</p>
              <p><strong>Time:</strong> ${lessonTime} PST</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
            </div>

            <p><strong>📅 Add to your calendar!</strong></p>
            <p>I've attached a calendar invite (.ics file) to this email. Just download and open it to add the lesson to your Apple Calendar or any other calendar app.</p>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>📧 What's next?</strong>
              <p style="margin: 10px 0 0 0;">I'll reach out via email before our session to share the meeting link and discuss what you'd like to work on. Feel free to reply to this email if you have any questions!</p>
            </div>

            <p>Looking forward to making some music with you!</p>
            <p>— Beau<br><span style="color: #666;">Low End Candy</span></p>
          </div>
        </body>
      </html>
    `;

    // Send both emails
    const [beauEmailResponse, customerEmailResponse] = await Promise.all([
      resend.emails.send({
        from: "Low End Candy <beau@lowendcandy.com>",
        to: ["beaurmcleod@gmail.com"],
        subject: `🎵 New Lesson Booked: ${lessonTitle} - ${displayDate} ${lessonTime}`,
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
        from: "Low End Candy <beau@lowendcandy.com>",
        to: [customerEmail],
        subject: `🎵 Your Lesson is Confirmed! - ${displayDate} ${lessonTime} PST`,
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
      customerEmail: customerEmailResponse 
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
