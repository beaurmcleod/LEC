import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CruxSubscription {
  id: string;
  status: string;
  current_period_end: string;
  site_product_slug: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
}

interface CruxLicense {
  id: string;
  license_key: string;
  status: string | null;
  daily_limit: number | null;
  requests_today: number | null;
  total_requests: number | null;
}

export function useCruxSubscription() {
  const [subscription, setSubscription] = useState<CruxSubscription | null>(null);
  const [license, setLicense] = useState<CruxLicense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [subRes, licRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, status, current_period_end, site_product_slug, cancel_at_period_end, stripe_subscription_id")
          .eq("user_id", user.id)
          .in("site_product_slug", ["crux-chords-monthly", "crux-chords-annual"])
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("licenses")
          .select("id, license_key, status, daily_limit, requests_today, total_requests")
          .eq("user_id", user.id)
          .eq("product", "crux_chords")
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);

      setSubscription(subRes.data ?? null);
      setLicense(licRes.data ?? null);
      setLoading(false);
    };

    fetch();
  }, []);

  return { subscription, license, isActive: !!subscription, loading };
}
