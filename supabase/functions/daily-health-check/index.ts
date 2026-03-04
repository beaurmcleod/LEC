import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  details: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: CheckResult[] = [];
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") || "beau@lowendcandy.com";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  try {
    // ─── CHECK 1: All products have valid data ───
    console.log("Check 1: Product data integrity");
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, title, price, image, category");

    if (prodErr) {
      results.push({ name: "Product Database", status: "fail", details: `Cannot query products: ${prodErr.message}` });
    } else if (!products || products.length === 0) {
      results.push({ name: "Product Database", status: "fail", details: "No products found in database" });
    } else {
      const issues: string[] = [];
      for (const p of products) {
        if (!p.price || p.price.trim() === "") issues.push(`${p.title}: missing price`);
        if (!p.image || p.image.trim() === "") issues.push(`${p.title}: missing image`);
        if (!p.category || p.category.trim() === "") issues.push(`${p.title}: missing category`);
        // Check for invalid price format (allow "Free" as valid)
        const priceStr = (p.price || "").trim();
        const isFreeStr = priceStr.toLowerCase() === "free";
        const priceNum = parseFloat(priceStr.replace(/\$/g, ""));
        if (!isFreeStr && isNaN(priceNum)) issues.push(`${p.title}: invalid price "${p.price}"`);
      }
      if (issues.length > 0) {
        results.push({ name: "Product Data", status: "fail", details: issues.join("; ") });
      } else {
        results.push({ name: "Product Data", status: "pass", details: `${products.length} products, all valid` });
      }
    }

    // ─── CHECK 2: Download URLs configured for paid products ───
    console.log("Check 2: Download URLs");
    if (products && products.length > 0) {
      const paidProducts = products.filter(p => {
        const price = parseFloat((p.price || "0").replace(/\$/g, ""));
        return price > 0 && p.category?.toLowerCase() !== "lessons";
      });

      const { data: downloads, error: dlErr } = await supabase
        .from("product_downloads")
        .select("product_id, download_url");

      if (dlErr) {
        results.push({ name: "Download URLs", status: "warn", details: `Cannot query downloads: ${dlErr.message}` });
      } else {
        const downloadProductIds = new Set((downloads || []).map(d => d.product_id));
        const missingDownloads = paidProducts.filter(p => !downloadProductIds.has(p.id));
        if (missingDownloads.length > 0) {
          results.push({
            name: "Download URLs",
            status: "fail",
            details: `Missing download URLs: ${missingDownloads.map(p => p.title).join(", ")}`,
          });
        } else {
          results.push({ name: "Download URLs", status: "pass", details: `${paidProducts.length} paid products all have download URLs` });
        }
      }
    }

    // ─── CHECK 3: Stripe API connectivity ───
    console.log("Check 3: Stripe connectivity");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      results.push({ name: "Stripe API", status: "fail", details: "STRIPE_SECRET_KEY not configured" });
    } else {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
        const balance = await stripe.balance.retrieve();
        results.push({ name: "Stripe API", status: "pass", details: `Connected, balance accessible` });
      } catch (stripeErr: any) {
        results.push({ name: "Stripe API", status: "fail", details: `Stripe error: ${stripeErr.message}` });
      }
    }

    // ─── CHECK 4: create-payment-intent edge function ───
    console.log("Check 4: Payment intent edge function");
    if (products && products.length > 0) {
      const testProduct = products.find(p => parseFloat((p.price || "0").replace(/\$/g, "")) > 0);
      if (testProduct) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/create-payment-intent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")}`,
            },
            body: JSON.stringify({
              productId: testProduct.id,
              customerEmail: "healthcheck@test.internal",
            }),
          });
          const respData = await resp.json();
          if (resp.ok && respData.client_secret) {
            results.push({ name: "Payment Intent Function", status: "pass", details: `Test payment intent created for "${testProduct.title}"` });
          } else {
            results.push({ name: "Payment Intent Function", status: "fail", details: `Response ${resp.status}: ${JSON.stringify(respData)}` });
          }
        } catch (fnErr: any) {
          results.push({ name: "Payment Intent Function", status: "fail", details: `Function unreachable: ${fnErr.message}` });
        }
      }
    }

    // ─── CHECK 5: Stripe webhook secret configured ───
    console.log("Check 5: Webhook secret");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      results.push({ name: "Stripe Webhook Secret", status: "fail", details: "STRIPE_WEBHOOK_SECRET not configured" });
    } else {
      results.push({ name: "Stripe Webhook Secret", status: "pass", details: "Configured" });
    }

    // ─── CHECK 6: Resend API key ───
    console.log("Check 6: Resend");
    if (!resendApiKey) {
      results.push({ name: "Resend Email", status: "fail", details: "RESEND_API_KEY not configured" });
    } else {
      results.push({ name: "Resend Email", status: "pass", details: "Configured" });
    }

    // ─── CHECK 7: Active coupons validity ───
    console.log("Check 7: Coupons");
    const { data: coupons, error: coupErr } = await supabase
      .from("coupons")
      .select("code, is_active, expires_at, current_uses, max_uses");

    if (!coupErr && coupons) {
      const issues: string[] = [];
      for (const c of coupons) {
        if (c.is_active && c.expires_at && new Date(c.expires_at) < new Date()) {
          issues.push(`Coupon "${c.code}" is active but expired`);
        }
        if (c.is_active && c.max_uses && c.current_uses >= c.max_uses) {
          issues.push(`Coupon "${c.code}" is active but max uses reached`);
        }
      }
      if (issues.length > 0) {
        results.push({ name: "Coupons", status: "warn", details: issues.join("; ") });
      } else {
        results.push({ name: "Coupons", status: "pass", details: `${coupons.filter(c => c.is_active).length} active coupons, all valid` });
      }
    }

    // ─── COMPILE RESULTS ───
    const elapsed = Date.now() - startTime;
    const failCount = results.filter(r => r.status === "fail").length;
    const warnCount = results.filter(r => r.status === "warn").length;
    const passCount = results.filter(r => r.status === "pass").length;
    const overallStatus = failCount > 0 ? "CRITICAL" : warnCount > 0 ? "WARNING" : "ALL CLEAR";

    const statusEmoji = { pass: "✅", fail: "❌", warn: "⚠️" };
    const subject = failCount > 0
      ? `🚨 CRITICAL: ${failCount} issue(s) found — Low End Candy Health Check`
      : warnCount > 0
      ? `⚠️ WARNING: ${warnCount} warning(s) — Low End Candy Health Check`
      : `✅ ALL CLEAR — Low End Candy Daily Health Check`;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
    const timeStr = now.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles" });

    const htmlRows = results.map(r => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; font-size: 20px;">${statusEmoji[r.status]}</td>
        <td style="padding: 12px; font-weight: 600;">${r.name}</td>
        <td style="padding: 12px; color: ${r.status === 'fail' ? '#dc2626' : r.status === 'warn' ? '#d97706' : '#16a34a'};">${r.details}</td>
      </tr>
    `).join("");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: ${failCount > 0 ? '#dc2626' : warnCount > 0 ? '#d97706' : '#16a34a'}; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${overallStatus}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Low End Candy • ${dateStr} • ${timeStr} PST</p>
        </div>
        <div style="padding: 24px;">
          <div style="display: flex; gap: 16px; margin-bottom: 24px; text-align: center;">
            <div style="flex: 1; background: #f0fdf4; padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${passCount}</div>
              <div style="font-size: 12px; color: #666;">Passed</div>
            </div>
            <div style="flex: 1; background: ${warnCount > 0 ? '#fffbeb' : '#f9fafb'}; padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #d97706;">${warnCount}</div>
              <div style="font-size: 12px; color: #666;">Warnings</div>
            </div>
            <div style="flex: 1; background: ${failCount > 0 ? '#fef2f2' : '#f9fafb'}; padding: 12px; border-radius: 8px;">
              <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${failCount}</div>
              <div style="font-size: 12px; color: #666;">Failed</div>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 8px; text-align: left; width: 40px;"></th>
                <th style="padding: 8px; text-align: left;">Check</th>
                <th style="padding: 8px; text-align: left;">Details</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
          <p style="margin-top: 24px; font-size: 12px; color: #999; text-align: center;">
            Health check completed in ${elapsed}ms • 
            <a href="https://low-end-beats-boutique.lovable.app" style="color: #666;">Visit Store</a> •
            <a href="https://supabase.com/dashboard/project/ocydkbblpnshbvkilngl/functions/daily-health-check/logs" style="color: #666;">View Logs</a>
          </p>
        </div>
      </div>
    `;

    // ─── SEND EMAIL ───
    if (resendApiKey) {
      console.log("Sending health check email to:", adminEmail);
      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Low End Candy <beau@lowendcandy.com>",
          to: [adminEmail],
          subject,
          html,
        }),
      });
      const emailData = await emailResp.json();
      console.log("Email send result:", emailData);
    } else {
      console.warn("No RESEND_API_KEY, skipping email");
    }

    // ─── INSTANT ALERT for critical failures (only if triggered by cron, not manual) ───
    // The instant alert is embedded in the same function — if there are failures, the email is sent immediately.

    return new Response(JSON.stringify({
      status: overallStatus,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
      results,
      elapsed_ms: elapsed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Health check fatal error:", err);

    // Send emergency alert
    if (resendApiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Low End Candy <beau@lowendcandy.com>",
          to: [adminEmail],
          subject: "🚨 EMERGENCY: Health check function crashed — Low End Candy",
          html: `<p>The daily health check function itself crashed:</p><pre>${err.message}\n${err.stack || ""}</pre><p>Check logs: <a href="https://supabase.com/dashboard/project/ocydkbblpnshbvkilngl/functions/daily-health-check/logs">View Logs</a></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
