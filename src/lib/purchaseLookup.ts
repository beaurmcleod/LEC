import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PurchaseRow = Pick<
  Tables<"purchases">,
  "id" | "product_id" | "purchased_at" | "amount_paid" | "customer_email" | "created_at"
>;

type ProductRow = Pick<Tables<"products_public">, "id" | "title" | "image">;

export interface Purchase {
  id: string;
  product_id: string;
  purchased_at: string;
  amount_paid: number;
  customer_email: string;
  products: {
    title: string;
    image: string;
    download_url: string;
  };
}

const PURCHASE_SELECT = "id, product_id, purchased_at, amount_paid, customer_email, created_at";

const addEmailCandidate = (set: Set<string>, email?: string | null) => {
  const trimmedEmail = email?.trim();

  if (!trimmedEmail) return;

  set.add(trimmedEmail);
  set.add(trimmedEmail.toLowerCase());
};

export const loadPurchasesForUser = async (
  userId: string,
  sessionEmail?: string | null
): Promise<Purchase[]> => {
  const emailCandidates = new Set<string>();
  addEmailCandidate(emailCandidates, sessionEmail);

  const [{ data: authData }, { data: profileData, error: profileError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("email").eq("id", userId).maybeSingle(),
  ]);

  if (profileError) {
    throw profileError;
  }

  addEmailCandidate(emailCandidates, authData.user?.email);
  addEmailCandidate(emailCandidates, profileData?.email);

  const purchaseQueries = [
    supabase
      .from("purchases")
      .select(PURCHASE_SELECT)
      .eq("user_id", userId)
      .order("purchased_at", { ascending: false }),
    ...Array.from(emailCandidates).map((email) =>
      supabase
        .from("purchases")
        .select(PURCHASE_SELECT)
        .ilike("customer_email", email)
        .order("purchased_at", { ascending: false })
    ),
  ];

  const purchaseResults = await Promise.all(purchaseQueries);
  const purchaseError = purchaseResults.find((result) => result.error)?.error;

  if (purchaseError) {
    throw purchaseError;
  }

  const purchaseMap = new Map<string, PurchaseRow>();

  purchaseResults.forEach((result) => {
    (result.data ?? []).forEach((purchase) => {
      purchaseMap.set(purchase.id, purchase as PurchaseRow);
    });
  });

  const uniquePurchases = Array.from(purchaseMap.values()).sort(
    (a, b) =>
      new Date(b.purchased_at ?? b.created_at ?? 0).getTime() -
      new Date(a.purchased_at ?? a.created_at ?? 0).getTime()
  );

  if (uniquePurchases.length === 0) {
    return [];
  }

  const productIds = Array.from(
    new Set(uniquePurchases.map((purchase) => purchase.product_id).filter(Boolean))
  );

  const productMap = new Map<string, ProductRow>();

  if (productIds.length > 0) {
    const { data: productData, error: productError } = await supabase
      .from("products_public")
      .select("id, title, image")
      .in("id", productIds);

    if (productError) {
      console.error("Error fetching product details for purchases:", productError);
    } else {
      (productData ?? []).forEach((product) => {
        if (product.id) {
          productMap.set(product.id, product as ProductRow);
        }
      });
    }
  }

  return uniquePurchases.map((purchase) => {
    const product = productMap.get(purchase.product_id);

    return {
      id: purchase.id,
      product_id: purchase.product_id,
      purchased_at: purchase.purchased_at ?? purchase.created_at ?? new Date().toISOString(),
      amount_paid: purchase.amount_paid,
      customer_email: purchase.customer_email,
      products: {
        title: product?.title ?? "Unknown Product",
        image: product?.image ?? "",
        download_url: "",
      },
    };
  });
};