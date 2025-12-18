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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body for optional filtering
    const body = await req.json().catch(() => ({}));
    const { startFrom, limit = 1 } = body; // Default to 1 at a time

    // Fetch purchases with product info
    let query = supabase
      .from("purchases")
      .select(`
        id,
        customer_email,
        amount_paid,
        purchased_at,
        stripe_payment_id,
        products:product_id (title)
      `)
      .order("purchased_at", { ascending: true })
      .limit(limit);

    if (startFrom) {
      query = query.gt("purchased_at", startFrom);
    }

    const { data: purchases, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching purchases:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch purchases" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!purchases || purchases.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No more purchases to process",
        processed: 0,
        lastProcessed: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const purchase of purchases) {
      const productTitle = (purchase.products as any)?.title || "Unknown Product";
      
      try {
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: purchase.customer_email,
            product_title: productTitle,
            amount_paid: purchase.amount_paid / 100, // Convert cents to dollars
            purchase_date: purchase.purchased_at,
            stripe_payment_id: purchase.stripe_payment_id,
            source: "bohemyth_store_backfill",
          }),
        });

        const success = response.ok;
        console.log(`Sent to GHL: ${purchase.customer_email} - ${productTitle} - ${success ? "SUCCESS" : "FAILED"}`);
        
        results.push({
          id: purchase.id,
          email: purchase.customer_email,
          product: productTitle,
          purchaseDate: purchase.purchased_at,
          success,
        });

        // Add a small delay between requests to avoid rate limiting
        if (purchases.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error sending ${purchase.customer_email} to GHL:`, error);
        results.push({
          id: purchase.id,
          email: purchase.customer_email,
          product: productTitle,
          purchaseDate: purchase.purchased_at,
          success: false,
          error: error.message,
        });
      }
    }

    const lastProcessed = purchases[purchases.length - 1].purchased_at;

    return new Response(JSON.stringify({
      message: `Processed ${results.length} purchase(s)`,
      processed: results.length,
      lastProcessed,
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
