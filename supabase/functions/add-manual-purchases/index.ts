import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create client with user's token to verify auth
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("Failed to verify token:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check if user is admin using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.error("User is not an admin:", userId);
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Admin user verified:", userId);

    const { purchases, productId, productTitle } = await req.json();
    
    const results: { email: string; status: string; error?: string }[] = [];
    
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
