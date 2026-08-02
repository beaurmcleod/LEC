// send-clap-drip — runs ONE pass of the "The Clap" lead-magnet → purchase email drip.
//
// The Clap is a free plugin lead magnet. Leads land in public.leads (source
// 'the-clap-lead-magnet') and are auto-enrolled into public.demo_leads
// (product 'the-clap') by the enroll_lead_magnet_drip() trigger. This function
// walks those leads through a 5-stage sequence toward the Preverb + Slingshot
// bundle ($70, normally $98).
//
// Called every 30 min by the "clap-drip-cron" pg_cron job (net.http_post +
// x-cron-token header, validated against public.cron_auth). Sends via Resend
// from beau@lowendcandy.com. Same house style + truth gate as send-demo-drip.
//
// SCHEDULING IS GAP-BASED, NOT SIGNUP-DATE-BASED. Each stage is due a fixed
// number of days after the PREVIOUS stage actually went out (stage 1 is due
// 1 day after enrollment). This is deliberate: the original version keyed off
// days-since-created_at, so when the deployment broke in July 2026 and 1,814
// leads went 3+ weeks without email, restoring it would have fired a
// late-stage "last one from me" at people who had never heard from us. Gap
// timing means an outage just delays the sequence instead of skipping it.
//
// Body: { dry_run?: boolean, limit?: number } — dry_run reports what would
// send and sends nothing.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PREVERB_PRODUCT_ID = "465a409a-80ac-4027-aee6-26c5fd36e4c3";
const SLINGSHOT_PRODUCT_ID = "6b8a1425-762e-43ee-adae-94d2e94cc7f8";
const BUNDLE_PRODUCT_ID = "adacbca2-0b13-46dc-a37e-234506643a5d";

// Buying any of these ends the drip — they're already in.
const SUPPRESS_PRODUCT_IDS = [PREVERB_PRODUCT_ID, SLINGSHOT_PRODUCT_ID, BUNDLE_PRODUCT_ID];

const DRIP_PRODUCT = "the-clap";
const FINAL_STAGE = 5;
const MAX_SENDS_PER_RUN = 25; // 25 per 30-min run ≈ 1,200/day — drains a backlog without torching sender reputation
const SEND_SPACING_MS = 400; // gentle pacing for Resend rate limits
const MAX_LEADS_SCANNED = 10000; // upper bound on how far back a single run will page
const LEAD_PAGE_SIZE = 1000; // Supabase caps a REST response at 1000 rows, so page at exactly that
const BUYER_CHECK_BATCH = 50; // keeps the purchases .in() filter inside URL length limits
const FROM = "Low End Candy <beau@lowendcandy.com>";

// Days to wait before each stage. Stage 1 counts from enrollment; every later
// stage counts from when the previous stage was actually sent.
const STAGE_GAP_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };

// ── HTML builders (visual style matches send-demo-drip) ──────────────────────
const P = (t: string) => `<p style="margin:0 0 20px 0;font-size:16px;color:#ccc;line-height:1.7;">${t}</p>`;
const PS = (t: string) => `<p style="margin:0;font-size:14px;color:#888;line-height:1.7;">${t}</p>`;
const CTA = (text: string, url: string) =>
  `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#ff3cac;border-radius:8px;padding:16px 32px;"><a href="${url}" style="color:#fff;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">${text} &rarr;</a></td></tr></table>`;
const LINK = (text: string, url: string) =>
  `<a href="${url}" style="color:#ff3cac;text-decoration:none;font-weight:700;">${text}</a>`;
const QUOTE = (text: string, attribution: string) =>
  `<table cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#1a1a1a;border:1px solid #333;border-radius:8px;width:100%;"><tr><td style="padding:20px 24px;"><p style="margin:0 0 12px 0;font-size:15px;color:#ccc;line-height:1.6;font-style:italic;">&ldquo;${text}&rdquo;</p><p style="margin:0;font-size:13px;color:#888;">&mdash; ${attribution}</p></td></tr></table>`;

const PREVERB_URL = (tag: string) => `https://lowendcandy.com/preverb?src=${tag}`;
const SLINGSHOT_URL = (tag: string) => `https://lowendcandy.com/slingshot?src=${tag}`;
const BUNDLE_URL = (tag: string) => `https://lowendcandy.com/product/preverb-slingshot-bundle?src=${tag}`;

function shell(greeting: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#666;">Low End Candy</p>
        </td></tr>
        <tr><td style="background:#111;border-radius:12px;padding:40px 36px;">
          ${P(greeting)}
          ${body}
          <p style="margin:28px 0 0 0;font-size:16px;color:#ccc;line-height:1.7;">&mdash; Beau (Bohemyth)</p>
        </td></tr>
        <tr><td style="padding:28px 0 0 0;">
          <p style="margin:0;font-size:12px;color:#444;line-height:1.7;">
            Not into these emails? Just reply &ldquo;stop&rdquo; and I&rsquo;ll take you off, no worries.<br>
            Low End Candy &middot; 3750 Jefferson St, Carlsbad, CA 92008
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Stage templates ──────────────────────────────────────────────────────────
// Truth gate: no invented testimonials, no deadlines the system doesn't
// actually enforce, no guarantees. The one quote used is the same verified
// quote already running in send-demo-drip. Prices reflect public.products:
// Preverb $49, Slingshot $49, bundle $70.
const STAGES: Record<number, { subject: string; body: string }> = {
  1: {
    subject: "did the claps land?",
    body:
      P("Quick one &mdash; did you get The Clap loaded in your DAW yet?") +
      P("If you haven&rsquo;t already, try this: put it <em>under</em> the clap you&rsquo;re already using instead of replacing it. Your clap keeps the transient, The Clap adds the room full of hands behind it. That&rsquo;s the move that makes a programmed clap stop sounding programmed.") +
      P("The other one worth trying: let it run across four bars without touching it. The hand-to-hand variation does the humanizing for you &mdash; no need to draw velocity by hand.") +
      P("Download not working, or it&rsquo;s not showing up in your plugin list? Just hit reply &mdash; I answer these myself."),
  },
  2: {
    subject: "what claps taught me about drops",
    body:
      P("Here&rsquo;s the thing about crowd claps that took me way too long to figure out.") +
      P("They don&rsquo;t work because they&rsquo;re loud. They work because they imply a <em>room</em> &mdash; a bunch of people who were already there, already reacting. Your ear fills in a space that was never recorded.") +
      P("Same principle runs the biggest moment in your track. A drop doesn&rsquo;t hit because it&rsquo;s loud. It hits because something told your ear it was coming.") +
      P(`That&rsquo;s the whole reason I built Preverb. It swells reverb <em>up into</em> a sound instead of trailing off behind it &mdash; so the sound feels pulled in rather than pasted in. Put it on the note right before your drop and you&rsquo;ll hear it immediately.`) +
      P(`Full breakdown here: ${LINK("lowendcandy.com/preverb", PREVERB_URL("clap2"))}`),
  },
  3: {
    subject: "two ways to pull someone into a drop",
    body:
      P("There are basically two ways to make a listener lean in before the hit lands, and I ended up building a plugin for each.") +
      P("<strong style=\"color:#fff;\">Preverb</strong> is the swell. Reverb rises up into the sound &mdash; smooth, cinematic, in key, built from whatever you feed it. Great before a drop, a vocal line, the last chord of a breakdown.") +
      P("<strong style=\"color:#fff;\">Slingshot</strong> is the stutter. Discrete reversed echoes that stack and crescendo into the hit, tempo-aware, from your own audio. Where Preverb glides, Slingshot builds.") +
      P("Most people end up wanting both, so I put them together: <strong style=\"color:#fff;\">$70 for the pair instead of $98.</strong> One-time payment, lifetime licenses, Mac + Windows, VST3 &amp; AU, instant download.") +
      CTA("Get the bundle — $70", BUNDLE_URL("clap3")) +
      PS(`Only want one? ${LINK("Preverb", PREVERB_URL("clap3"))} or ${LINK("Slingshot", SLINGSHOT_URL("clap3"))} are $49 each.`),
  },
  4: {
    subject: "the version of this that takes six steps",
    body:
      P("The old way to get a reverse-reverb swell in front of a sound:") +
      P("Bounce the audio. Reverse it. Put a huge reverb on it. Bounce <em>that</em>. Reverse it again. Drag it in front of the hit and hope you lined it up right. Then change one note in the melody and do the entire thing over.") +
      P("Engineers have used that trick on vocals for decades &mdash; it&rsquo;s a big part of why records feel like sounds <em>arrive</em> instead of just appearing. Preverb does the whole ritual live, in real time. Tweak the melody and the swell follows.") +
      QUOTE("Preverb is by far, and already in just a few minutes, in another league!", "Kirke Jan Blankenship, Composer / Producer / Sound Designer") +
      P("Slingshot runs the same idea through reversed echoes instead of reverb, and both have CAPTURE &mdash; print the lead-in straight to a WAV you drag into the session, no manual bouncing.") +
      CTA("Both for $70", BUNDLE_URL("clap4")),
  },
  5: {
    subject: "last one from me",
    body:
      P("Last email in this sequence &mdash; The Clap is yours to keep either way, no strings.") +
      P(`If the timing just isn&rsquo;t right, all good. The door stays open at ${LINK("lowendcandy.com", BUNDLE_URL("clap5"))} whenever you want it.`) +
      P("Either way, I&rsquo;d love one favor: hit reply and tell me what you&rsquo;re working on, or the one thing you wish a plugin would just do for you already. One sentence is plenty. I read every single one and it genuinely shapes what I build next.") +
      P("Keep making stuff that slaps."),
  },
};

function greetingFor(firstName: string | null): string {
  if (firstName && firstName.trim()) {
    const n = firstName.trim();
    return `Hey ${n.charAt(0).toUpperCase() + n.slice(1)} —`;
  }
  return "Hey there —";
}

const DAY_MS = 86400000;

/**
 * Highest stage this lead is currently due for, or 0 if none.
 * Stage 1 is measured from enrollment; later stages from the previous send.
 */
function dueStage(lead: { last_stage_sent: number; stage_sent_at: string | null; created_at: string }): number {
  const next = (lead.last_stage_sent || 0) + 1;
  if (next > FINAL_STAGE || !STAGES[next]) return 0;

  // Fall back to created_at when stage_sent_at is missing (never-sent leads,
  // and any row where an earlier send didn't record a timestamp).
  const since = lead.last_stage_sent > 0 && lead.stage_sent_at
    ? new Date(lead.stage_sent_at).getTime()
    : new Date(lead.created_at).getTime();

  const daysWaited = (Date.now() - since) / DAY_MS;
  return daysWaited >= STAGE_GAP_DAYS[next] ? next : 0;
}

serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: x-cron-token must match a row in cron_auth.
    const token = req.headers.get("x-cron-token") || "";
    const { data: auth } = await supabase.from("cron_auth").select("token").eq("token", token).maybeSingle();
    if (!token || !auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    let dryRun = false;
    let runCap = MAX_SENDS_PER_RUN;
    try {
      const body = await req.json();
      dryRun = !!body?.dry_run;
      if (Number.isFinite(body?.limit)) runCap = Math.max(0, Math.min(MAX_SENDS_PER_RUN, Number(body.limit)));
    } catch (_e) { /* empty body = live run at the default cap */ }

    // 1. Active Clap leads, oldest first so the backlog drains in signup order.
    // MUST paginate: Supabase caps a REST response at 1000 rows server-side, so
    // a single query silently truncates and starves every lead past the first
    // 1000 — including brand-new signups sitting behind a large backlog.
    const leads: Array<{
      id: string; email: string; first_name: string | null;
      last_stage_sent: number; stage_sent_at: string | null; created_at: string;
    }> = [];
    for (let offset = 0; offset < MAX_LEADS_SCANNED; offset += LEAD_PAGE_SIZE) {
      const { data: page, error: leadsError } = await supabase
        .from("demo_leads")
        .select("id, email, first_name, last_stage_sent, stage_sent_at, created_at")
        .eq("product", DRIP_PRODUCT)
        .eq("status", "active")
        .order("created_at")
        .order("id") // tiebreaker — without it, equal timestamps can repeat or skip rows across pages
        .range(offset, offset + LEAD_PAGE_SIZE - 1);
      if (leadsError) throw leadsError;
      if (!page || page.length === 0) break;
      leads.push(...page);
      if (page.length < LEAD_PAGE_SIZE) break;
    }
    if (leads.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, purchased: 0, note: "no active leads" }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Narrow to leads actually due before touching the purchases table. The
    // buyer lookup is an .in() filter in the query string, so it has to run
    // over a small batch — passing all ~2k lead emails would blow past the
    // URL length limit and fail the whole run.
    const dueLeads: Array<{ lead: typeof leads[number]; stage: number }> = [];
    for (const lead of leads) {
      const stage = dueStage(lead);
      if (stage > 0) dueLeads.push({ lead, stage });
    }

    let purchased = 0;
    let sent = 0;
    const results: string[] = [];

    // 3. Walk the due list in small batches, checking each batch for buyers.
    for (let i = 0; i < dueLeads.length && sent < runCap; i += BUYER_CHECK_BATCH) {
      const batch = dueLeads.slice(i, i + BUYER_CHECK_BATCH);
      const { data: buyers } = await supabase
        .from("purchases")
        .select("customer_email")
        .in("product_id", SUPPRESS_PRODUCT_IDS)
        .in("customer_email", batch.map((b) => b.lead.email.toLowerCase()));
      const buyerSet = new Set((buyers || []).map((b) => (b.customer_email || "").toLowerCase()));

      for (const { lead, stage: due } of batch) {
        if (sent >= runCap) break;

        // Anyone who already bought Preverb/Slingshot/the bundle drops out.
        if (buyerSet.has(lead.email.toLowerCase())) {
          purchased++;
          if (!dryRun) {
            await supabase.from("demo_leads").update({ status: "purchased", updated_at: new Date().toISOString() }).eq("id", lead.id);
          }
          results.push(`${lead.email}: purchased`);
          continue;
        }

        const tpl = STAGES[due];
        if (dryRun) { sent++; results.push(`${lead.email}: WOULD send stage ${due} ("${tpl.subject}")`); continue; }

        // 3. Send via Resend.
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from: FROM, to: [lead.email], subject: tpl.subject, html: shell(greetingFor(lead.first_name), tpl.body) }),
        });
        if (!res.ok) {
          console.error("Resend error for", lead.email, res.status, await res.text());
          results.push(`${lead.email}: stage ${due} FAILED (retries next run)`);
          continue;
        }

        // 4. Mark sent; the final stage completes the sequence.
        await supabase
          .from("demo_leads")
          .update({
            last_stage_sent: due,
            stage_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(due === FINAL_STAGE ? { status: "completed" } : {}),
          })
          .eq("id", lead.id);
        sent++;
        results.push(`${lead.email}: sent stage ${due}`);
        await new Promise((r) => setTimeout(r, SEND_SPACING_MS));
      }
    }

    // `deferred` is the backlog still waiting on the per-run cap — it should
    // trend to 0 over successive runs. If it doesn't, the cap is too low.
    const deferred = Math.max(0, dueLeads.length - sent - purchased);
    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, sent, purchased, deferred, due_now: dueLeads.length, total_active: leads.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-clap-drip error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
