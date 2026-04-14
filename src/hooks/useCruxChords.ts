import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CruxSubscription {
  id: string;
  status: string;
  current_period_end: string;
  site_product_slug: string | null;
  cancel_at_period_end: boolean;
}

interface CruxLicense {
  id: string;
  license_key: string;
  status: string | null;
  daily_limit: number | null;
  requests_today: number | null;
  total_requests: number | null;
}

interface CruxPlans {
  monthly: { id: string; price_cents: number; slug: string } | null;
  annual: { id: string; price_cents: number; slug: string } | null;
}

export function useCruxChords() {
  const [subscription, setSubscription] = useState<CruxSubscription | null>(null);
  const [license, setLicense] = useState<CruxLicense | null>(null);
  const [plans, setPlans] = useState<CruxPlans>({ monthly: null, annual: null });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Fetch plans and auth in parallel
      const [plansRes, authRes] = await Promise.all([
        supabase
          .from("site_products")
          .select("id, slug, price_cents")
          .ilike("slug", "crux-chords%")
          .eq("is_active", true),
        supabase.auth.getUser(),
      ]);

      if (plansRes.data) {
        const monthly = plansRes.data.find((p) => p.slug.includes("monthly"));
        const annual = plansRes.data.find((p) => p.slug.includes("annual"));
        setPlans({
          monthly: monthly ? { id: monthly.id, price_cents: monthly.price_cents, slug: monthly.slug } : null,
          annual: annual ? { id: annual.id, price_cents: annual.price_cents, slug: annual.slug } : null,
        });
      }

      const authUser = authRes.data?.user;
      if (!authUser) {
        setLoading(false);
        return;
      }
      setUser({ id: authUser.id, email: authUser.email ?? "" });

      // Fetch subscription and license in parallel
      const [subsRes, licsRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, status, current_period_end, site_product_slug, cancel_at_period_end")
          .eq("user_id", authUser.id)
          .in("site_product_slug", ["crux-chords-monthly", "crux-chords-annual"])
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("licenses")
          .select("id, license_key, status, daily_limit, requests_today, total_requests")
          .eq("user_id", authUser.id)
          .eq("product", "crux_chords")
          .limit(1),
      ]);

      if (subsRes.data && subsRes.data.length > 0) {
        setSubscription(subsRes.data[0]);
      }
      if (licsRes.data && licsRes.data.length > 0) {
        setLicense(licsRes.data[0]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  return { subscription, license, plans, loading, user, isActive };
}
