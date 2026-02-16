import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/58511dnwpiw4i2w6ej3eyyiumlhqh7a0";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    // Fetch all link clicks
    const { data: clicks, error: clicksError } = await supabase
      .from('link_clicks')
      .select('link_title, link_url, clicked_at')
      .order('clicked_at', { ascending: false });

    if (clicksError) throw clicksError;

    // Aggregate clicks by link (top 10)
    const linkMap = new Map<string, { link_title: string; link_url: string; click_count: number }>();
    (clicks || []).forEach((click: any) => {
      const key = click.link_url;
      if (linkMap.has(key)) {
        linkMap.get(key)!.click_count += 1;
      } else {
        linkMap.set(key, { link_title: click.link_title, link_url: click.link_url, click_count: 1 });
      }
    });
    const topLinks = Array.from(linkMap.values()).sort((a, b) => b.click_count - a.click_count).slice(0, 10);

    // Daily click breakdown (last 14 days)
    const dateMap = new Map<string, number>();
    (clicks || []).forEach((click: any) => {
      const date = new Date(click.clicked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });
    const dailyBreakdown = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, clicks: count }))
      .slice(-14);

    const payload = {
      type: "admin_dashboard_export",
      exported_at: new Date().toISOString(),
      total_clicks: (clicks || []).length,
      top_links: topLinks,
      daily_click_breakdown: dailyBreakdown,
      total_signups: (profiles || []).length,
      user_signups: (profiles || []).map((p: any) => ({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        signed_up: p.created_at,
      })),
    };

    const webhookResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      throw new Error(`Make.com webhook failed [${webhookResponse.status}]: ${errorText}`);
    }

    await webhookResponse.text();

    return new Response(JSON.stringify({ success: true, signups_sent: payload.total_signups, clicks_sent: payload.total_clicks }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
