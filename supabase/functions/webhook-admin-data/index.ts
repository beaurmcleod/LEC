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

    // Fetch all data in parallel
    const [clicksRes, profilesRes, purchasesRes, productsRes] = await Promise.all([
      supabase.from('link_clicks').select('link_title, link_url, clicked_at, user_id').order('clicked_at', { ascending: false }),
      supabase.from('profiles').select('id, first_name, last_name, email, created_at').order('created_at', { ascending: false }),
      supabase.from('purchases').select('customer_email, product_id, amount_paid, stripe_payment_id, purchased_at, user_id').order('purchased_at', { ascending: false }),
      supabase.from('products').select('id, title, price'),
    ]);

    if (clicksRes.error) throw clicksRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (purchasesRes.error) throw purchasesRes.error;
    if (productsRes.error) throw productsRes.error;

    // Build lookup maps
    const profileMap = new Map<string, any>();
    (profilesRes.data || []).forEach((p: any) => {
      profileMap.set(p.id, p);
    });

    const productMap = new Map<string, any>();
    (productsRes.data || []).forEach((p: any) => {
      productMap.set(p.id, p);
    });

    // Build email-to-profile lookup for matching purchases to profiles
    const emailProfileMap = new Map<string, any>();
    (profilesRes.data || []).forEach((p: any) => {
      emailProfileMap.set(p.email, p);
    });

    // Individual click events enriched with user info
    const clickEvents = (clicksRes.data || []).map((click: any) => {
      const profile = click.user_id ? profileMap.get(click.user_id) : null;
      return {
        website: "lowendcandy.com",
        page: click.link_url,
        link_clicked: click.link_title,
        clicked_at: click.clicked_at,
        user_first_name: profile?.first_name || null,
        user_last_name: profile?.last_name || null,
        user_email: profile?.email || null,
      };
    });

    // Purchase events with customer info
    const purchaseEvents = (purchasesRes.data || []).map((p: any) => {
      const profile = p.user_id ? profileMap.get(p.user_id) : emailProfileMap.get(p.customer_email);
      const product = productMap.get(p.product_id);
      return {
        event_type: "purchase",
        product_title: product?.title || "Unknown",
        product_price: product?.price || null,
        amount_paid: p.amount_paid,
        purchased_at: p.purchased_at,
        stripe_payment_id: p.stripe_payment_id,
        customer_email: p.customer_email,
        customer_first_name: profile?.first_name || null,
        customer_last_name: profile?.last_name || null,
      };
    });

    // User signups
    const signups = (profilesRes.data || []).map((p: any) => ({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      signed_up: p.created_at,
    }));

    const payload = {
      type: "admin_dashboard_full_export",
      website: "lowendcandy.com",
      exported_at: new Date().toISOString(),
      summary: {
        total_clicks: clickEvents.length,
        total_purchases: purchaseEvents.length,
        total_signups: signups.length,
      },
      link_click_events: clickEvents,
      purchase_events: purchaseEvents,
      user_signups: signups,
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

    return new Response(JSON.stringify({
      success: true,
      clicks_sent: clickEvents.length,
      purchases_sent: purchaseEvents.length,
      signups_sent: signups.length,
    }), {
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
