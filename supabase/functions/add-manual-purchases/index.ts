import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const GHL_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/84LVJ79Hb6dDlqcCFKVc/webhook-trigger/7e17eafa-bfec-4f9a-8ece-311a11d5db3b";

interface ManualPurchase {
  email: string;
  name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This is a one-time use function, verify with service key presence
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { purchases, productId, productTitle } = await req.json();
    
    const results = [];
    
    for (const purchase of purchases as ManualPurchase[]) {
      // Insert purchase record
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          product_id: productId,
          customer_email: purchase.email,
          amount_paid: 0,
          stripe_payment_id: `manual_${purchase.email.replace(/[@.]/g, '_')}_${Date.now()}`,
        })
        .select()
        .single();

      if (purchaseError) {
        console.error("Error inserting purchase:", purchaseError);
        results.push({ email: purchase.email, status: "error", error: purchaseError.message });
        continue;
      }

      // Send to GHL
      try {
        const ghlResponse = await fetch(GHL_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: purchase.email,
            first_name: purchase.name.split(" ")[0],
            last_name: purchase.name.split(" ").slice(1).join(" ") || "",
            product_title: productTitle,
            amount_paid: 0,
            purchase_date: new Date().toISOString(),
            stripe_payment_id: purchaseData.stripe_payment_id,
            source: "bohemyth_store_manual",
          }),
        });

        if (ghlResponse.ok) {
          console.log("GHL sent successfully for:", purchase.email);
          results.push({ email: purchase.email, status: "success" });
        } else {
          console.error("GHL failed for:", purchase.email);
          results.push({ email: purchase.email, status: "ghl_failed" });
        }
      } catch (ghlError) {
        console.error("GHL error:", ghlError);
        results.push({ email: purchase.email, status: "ghl_error" });
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
