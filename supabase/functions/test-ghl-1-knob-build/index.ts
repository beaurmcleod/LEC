import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/84LVJ79Hb6dDlqcCFKVc/webhook-trigger/32c6085c-5fe8-4d18-8a86-33eaff800f3d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Sending test payload for 1 Knob Build to GHL...");

    const testPayload = {
      email: "test@bohemyth.com",
      product_title: "1 Knob Build",
      amount_paid: 3.00,
      purchase_date: new Date().toISOString(),
      stripe_payment_id: "pi_test_1knob_" + Date.now(),
      source: "bohemyth_store_test",
    };

    console.log("Payload:", JSON.stringify(testPayload));

    const response = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    console.log("GHL Response status:", response.status);
    console.log("GHL Response:", responseText);

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      product: "1 Knob Build",
      payload: testPayload,
      ghlResponse: responseText,
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
