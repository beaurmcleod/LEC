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
  lessonDate: z.string(), // ISO date string
  lessonTime: z.string(), // e.g., "10:00 AM"
  durationMinutes: z.number(),
  amountPaid: z.number(),
});

function generateICSFile(
  title: string,
  startDate: Date,
  durationMinutes: number,
  customerEmail: string
): string {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const uid = `${Date.now()}-lesson@lowendcandy.com`;
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Low End Candy//Lesson Booking//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title} - ${customerEmail}
DESCRIPTION:Music production lesson with ${customerEmail}
STATUS:CONFIRMED
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

    const { customerEmail, lessonTitle, lessonDate, lessonTime, durationMinutes, amountPaid } = validation.data;

    // Parse the date and time
    const startDate = parseTimeToDate(lessonDate, lessonTime);
    
    // Generate ICS file content
    const icsContent = generateICSFile(lessonTitle, startDate, durationMinutes, customerEmail);
    const icsBase64 = btoa(icsContent);

    console.log("Sending lesson notification to beaurmcleod@gmail.com");

    const emailHtml = `
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
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎵 New Lesson Booked!</h1>
          </div>
          <div class="content">
            <p>A new lesson has been booked and paid for!</p>
            
            <div class="lesson-info">
              <h3>Lesson Details</h3>
              <p><strong>Customer:</strong> <span class="highlight">${customerEmail}</span></p>
              <p><strong>Package:</strong> ${lessonTitle}</p>
              <p><strong>Date:</strong> ${lessonDate}</p>
              <p><strong>Time:</strong> ${lessonTime} PST</p>
              <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
              <p><strong>Amount Paid:</strong> $${amountPaid.toFixed(2)}</p>
            </div>

            <p><strong>📅 Calendar invite attached!</strong></p>
            <p>Download the .ics file attached to this email to add this lesson to your calendar.</p>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Don't forget to reach out to the student to confirm any additional details!
            </p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Low End Candy <beau@lowendcandy.com>",
      to: ["beaurmcleod@gmail.com"],
      subject: `🎵 New Lesson Booked: ${lessonTitle} - ${lessonDate} ${lessonTime}`,
      html: emailHtml,
      attachments: [
        {
          filename: "lesson-booking.ics",
          content: icsBase64,
          content_type: "text/calendar",
        },
      ],
    });

    console.log("Lesson notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error sending lesson notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send lesson notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
