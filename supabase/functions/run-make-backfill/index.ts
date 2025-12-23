import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/9568sygekt6l2vvyjbtvamhd1ptuim46";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Make.com backfill for all purchases...");

    // Fetch all purchases with product info
    const { data: purchases, error: fetchError } = await supabase
      .from("purchases")
      .select(`
        id,
        customer_email,
        amount_paid,
        purchased_at,
        stripe_payment_id,
        products:product_id (title)
      `)
      .order("purchased_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching purchases:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch purchases" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${purchases?.length || 0} purchases to process`);

    const results = [];

    for (let i = 0; i < (purchases?.length || 0); i++) {
      const purchase = purchases![i];
      const productTitle = (purchase.products as any)?.title || "Unknown Product";
      
      try {
        console.log(`[${i + 1}/${purchases!.length}] Sending: ${purchase.customer_email} - ${productTitle}`);
        
        const response = await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: purchase.customer_email,
            first_name: "",
            last_name: "",
            product_title: productTitle,
            amount_paid: purchase.amount_paid / 100,
            purchase_date: purchase.purchased_at,
            stripe_payment_id: purchase.stripe_payment_id,
            source: "bohemyth_store_backfill",
          }),
        });

        const success = response.ok;
        console.log(`[${i + 1}/${purchases!.length}] ${success ? "SUCCESS" : "FAILED"}`);
        
        results.push({
          email: purchase.customer_email,
          product: productTitle,
          success,
        });

        // Wait 1 second between requests
        if (i < purchases!.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error sending ${purchase.customer_email}:`, error);
        results.push({
          email: purchase.customer_email,
          product: productTitle,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Backfill complete: ${successCount}/${results.length} successful`);

    return new Response(JSON.stringify({
      message: `Processed ${results.length} purchases`,
      successful: successCount,
      failed: results.length - successCount,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
