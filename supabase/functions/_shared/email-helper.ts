import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface SendEmailOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  site: string;
  emailType: string;
  productId?: string;
  purchaseId?: string;
  stripePaymentId?: string;
  edgeFunction: string;
  attachments?: Array<{ filename: string; content: string; content_type: string }>;
  replyTo?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  queued?: boolean;
}

const ADMIN_EMAIL = "beau@lowendcandy.com";

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function logTransaction(
  supabase: ReturnType<typeof createClient>,
  options: {
    site: string;
    eventType: string;
    status: string;
    customerEmail?: string;
    productId?: string;
    stripePaymentId?: string;
    edgeFunction: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("transaction_log").insert({
      site: options.site,
      event_type: options.eventType,
      status: options.status,
      customer_email: options.customerEmail || null,
      product_id: options.productId || null,
      stripe_payment_id: options.stripePaymentId || null,
      edge_function: options.edgeFunction,
      error_message: options.errorMessage || null,
      metadata: options.metadata || null,
    });
  } catch (e) {
    console.error("Failed to log transaction:", e);
  }
}

function getBackoffMinutes(retryCount: number): number {
  const backoffs = [10, 30, 60, 180, 360]; // 10min, 30min, 1hr, 3hr, 6hr
  return backoffs[Math.min(retryCount, backoffs.length - 1)];
}

async function queueForRetry(
  supabase: ReturnType<typeof createClient>,
  options: SendEmailOptions,
  errorMessage: string
) {
  try {
    const nextRetryAt = new Date();
    nextRetryAt.setMinutes(nextRetryAt.getMinutes() + 10); // First retry at 10 minutes

    await supabase.from("email_retry_queue").insert({
      customer_email: options.to,
      email_type: options.emailType,
      site: options.site,
      subject: options.subject,
      payload: {
        to: options.to,
        from: options.from,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments || [],
        replyTo: options.replyTo || null,
      },
      status: "pending",
      retry_count: 0,
      next_retry_at: nextRetryAt.toISOString(),
      last_error: errorMessage,
    });
    console.log("Email queued for retry:", options.to, options.emailType);
  } catch (e) {
    console.error("Failed to queue email for retry:", e);
  }
}

async function sendAlertEmail(errorDetails: string, originalTo: string, subject: string) {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `Low End Candy Alerts <${ADMIN_EMAIL}>`,
        to: [ADMIN_EMAIL],
        subject: `⚠️ Email failed: ${subject}`,
        html: `<h2>⚠️ Email Send Failed</h2>
          <p><strong>Recipient:</strong> ${originalTo}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Error:</strong> ${errorDetails}</p>
          <p>The email has been queued for automatic retry. Check the email_retry_queue table for status.</p>`,
      }),
    });
  } catch (e) {
    console.error("Failed to send alert email:", e);
  }
}

export async function sendEmailWithFailsafe(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const supabase = getSupabaseClient();
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!resendKey) {
    const err = "RESEND_API_KEY not configured";
    console.error(err);
    await logTransaction(supabase, {
      site: options.site,
      eventType: "email_send_failed",
      status: "failed",
      customerEmail: options.to,
      productId: options.productId,
      stripePaymentId: options.stripePaymentId,
      edgeFunction: options.edgeFunction,
      errorMessage: err,
    });
    return { success: false, error: err };
  }

  // Log attempt
  await logTransaction(supabase, {
    site: options.site,
    eventType: "email_send_attempted",
    status: "pending",
    customerEmail: options.to,
    productId: options.productId,
    stripePaymentId: options.stripePaymentId,
    edgeFunction: options.edgeFunction,
    metadata: { emailType: options.emailType, subject: options.subject },
  });

  try {
    // Build recipients list - always CC beau
    const toList = [options.to];
    const ccList: string[] = [];
    if (options.to.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      ccList.push(ADMIN_EMAIL);
    }

    const emailPayload: Record<string, unknown> = {
      from: options.from,
      to: toList,
      subject: options.subject,
      html: options.html,
    };

    if (ccList.length > 0) {
      emailPayload.cc = ccList;
    }
    if (options.replyTo) {
      emailPayload.reply_to = options.replyTo;
    }
    if (options.attachments && options.attachments.length > 0) {
      emailPayload.attachments = options.attachments;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Resend API error ${res.status}: ${errorText}`);
    }

    const result = await res.json();
    console.log("Email sent successfully:", options.to, result);

    // Log success
    await logTransaction(supabase, {
      site: options.site,
      eventType: "email_send_success",
      status: "success",
      customerEmail: options.to,
      productId: options.productId,
      stripePaymentId: options.stripePaymentId,
      edgeFunction: options.edgeFunction,
      metadata: { emailType: options.emailType, resendId: result.id },
    });

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Email send failed:", errMsg);

    // Log failure
    await logTransaction(supabase, {
      site: options.site,
      eventType: "email_send_failed",
      status: "failed",
      customerEmail: options.to,
      productId: options.productId,
      stripePaymentId: options.stripePaymentId,
      edgeFunction: options.edgeFunction,
      errorMessage: errMsg,
      metadata: { emailType: options.emailType },
    });

    // Queue for retry
    await queueForRetry(supabase, options, errMsg);

    // Send alert
    await sendAlertEmail(errMsg, options.to, options.subject);

    return { success: false, error: errMsg, queued: true };
  }
}

export { getBackoffMinutes, logTransaction, ADMIN_EMAIL };
