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

export function useCruxSubscription() {
  const [subscription, setSubscription] = useState<CruxSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end, site_product_slug, cancel_at_period_end, stripe_subscription_id")
        .eq("user_id", user.id)
        .in("site_product_slug", ["crux-chords-monthly", "crux-chords-annual"])
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(data ?? null);
      setLoading(false);
    };

    fetch();
  }, []);

  return { subscription, isActive: !!subscription, loading };
}
