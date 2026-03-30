import { useEffect, useState, useCallback } from "react";
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
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubscription(null);
      setLicense(null);
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const subscribe = useCallback(async (productSlug: string): Promise<string | null> => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-subscription", {
        body: { product_slug: productSlug },
      });
      if (error) throw error;
      return data?.url ?? null;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const cancelSubscription = useCallback(async (): Promise<void> => {
    if (!subscription) throw new Error("No active subscription");
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("cancel-subscription", {
        body: { subscription_id: subscription.id },
      });
      if (error) throw error;
      await fetchData();
    } finally {
      setActionLoading(false);
    }
  }, [subscription, fetchData]);

  return {
    subscription,
    license,
    isActive: !!subscription,
    loading,
    actionLoading,
    subscribe,
    cancelSubscription,
    refetch: fetchData,
  };
}
