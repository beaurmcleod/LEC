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
    console.log("Sending one test per product to Make.com...");

    // Fetch all products
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, title, price")
      .order("title", { ascending: true });

    if (fetchError) {
      console.error("Error fetching products:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${products?.length || 0} products`);

    const results = [];

    for (let i = 0; i < (products?.length || 0); i++) {
      const product = products![i];
      
      try {
        console.log(`[${i + 1}/${products!.length}] Sending test for: ${product.title}`);
        
        const response = await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@bohemyth.com",
            first_name: "Test",
            last_name: "User",
            product_title: product.title,
            amount_paid: parseFloat(product.price.replace(/[^0-9.]/g, '')) || 0,
            purchase_date: new Date().toISOString(),
            stripe_payment_id: `pi_test_product_${product.id}`,
            source: "bohemyth_product_test",
          }),
        });

        const success = response.ok;
        console.log(`[${i + 1}/${products!.length}] ${product.title} - ${success ? "SUCCESS" : "FAILED"}`);
        
        results.push({
          product: product.title,
          price: product.price,
          success,
        });

        // Wait 1 second between requests
        if (i < products!.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error sending ${product.title}:`, error);
        results.push({
          product: product.title,
          price: product.price,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Complete: ${successCount}/${results.length} successful`);

    return new Response(JSON.stringify({
      message: `Sent test for ${results.length} products`,
      successful: successCount,
      failed: results.length - successCount,
      results,
    }), {
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
