import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getBackoffMinutes, logTransaction, ADMIN_EMAIL } from "../_shared/email-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch emails ready for retry
    const { data: retryItems, error: fetchError } = await supabase
      .from("email_retry_queue")
      .select("*")
      .in("status", ["pending", "retrying"])
      .lte("next_retry_at", new Date().toISOString())
      .lt("retry_count", 5)
      .limit(20);

    if (fetchError) {
      console.error("Error fetching retry queue:", fetchError);
      throw fetchError;
    }

    if (!retryItems || retryItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No emails to retry", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${retryItems.length} retry items`);
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of retryItems) {
      const payload = item.payload as Record<string, unknown>;
      const toList = [payload.to as string];
      const ccList: string[] = [];
      if ((payload.to as string).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        ccList.push(ADMIN_EMAIL);
      }

      const emailPayload: Record<string, unknown> = {
        from: payload.from,
        to: toList,
        subject: payload.subject,
        html: payload.html,
      };
      if (ccList.length > 0) emailPayload.cc = ccList;
      if (payload.replyTo) emailPayload.reply_to = payload.replyTo;
      if (payload.attachments && (payload.attachments as unknown[]).length > 0) {
        emailPayload.attachments = payload.attachments;
      }

      try {
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

        console.log("Retry succeeded for:", item.customer_email);

        // Mark as sent
        await supabase
          .from("email_retry_queue")
          .update({ status: "sent", updated_at: new Date().toISOString() })
          .eq("id", item.id);

        await logTransaction(supabase, {
          site: item.site,
          eventType: "email_retry_success",
          status: "success",
          customerEmail: item.customer_email,
          edgeFunction: "retry-failed-emails",
          metadata: { emailType: item.email_type, retryCount: item.retry_count },
        });

        results.push({ id: item.id, success: true });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const newRetryCount = item.retry_count + 1;
        console.error(`Retry failed for ${item.customer_email} (attempt ${newRetryCount}):`, errMsg);

        if (newRetryCount >= 5) {
          // Permanent failure
          await supabase
            .from("email_retry_queue")
            .update({
              status: "failed_permanent",
              retry_count: newRetryCount,
              last_error: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          await logTransaction(supabase, {
            site: item.site,
            eventType: "email_retry_permanent_failure",
            status: "failed",
            customerEmail: item.customer_email,
            edgeFunction: "retry-failed-emails",
            errorMessage: errMsg,
            metadata: { emailType: item.email_type, retryCount: newRetryCount },
          });

          // Send permanent failure alert
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: `Low End Candy Alerts <${ADMIN_EMAIL}>`,
                to: [ADMIN_EMAIL],
                subject: `🚨 Email permanently failed after 5 retries`,
                html: `<h2>🚨 Permanent Email Failure</h2>
                  <p><strong>Recipient:</strong> ${item.customer_email}</p>
                  <p><strong>Type:</strong> ${item.email_type}</p>
                  <p><strong>Subject:</strong> ${item.subject || "N/A"}</p>
                  <p><strong>Last Error:</strong> ${errMsg}</p>
                  <p>This email failed 5 times and will not be retried. Manual intervention required.</p>`,
              }),
            });
          } catch (alertErr) {
            console.error("Failed to send permanent failure alert:", alertErr);
          }
        } else {
          // Schedule next retry with exponential backoff
          const backoffMinutes = getBackoffMinutes(newRetryCount);
          const nextRetryAt = new Date();
          nextRetryAt.setMinutes(nextRetryAt.getMinutes() + backoffMinutes);

          await supabase
            .from("email_retry_queue")
            .update({
              status: "retrying",
              retry_count: newRetryCount,
              next_retry_at: nextRetryAt.toISOString(),
              last_error: errMsg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          await logTransaction(supabase, {
            site: item.site,
            eventType: "email_retry_failed",
            status: "failed",
            customerEmail: item.customer_email,
            edgeFunction: "retry-failed-emails",
            errorMessage: errMsg,
            metadata: {
              emailType: item.email_type,
              retryCount: newRetryCount,
              nextRetryMinutes: backoffMinutes,
            },
          });
        }

        results.push({ id: item.id, success: false, error: errMsg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in retry-failed-emails:", errMsg);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
