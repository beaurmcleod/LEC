import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/9568sygekt6l2vvyjbtvamhd1ptuim46";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Sending test payload to Make.com...");

    const testPayload = {
      first_name: "Marcus",
      last_name: "Johnson",
      email: "marcus.johnson@gmail.com",
      product_title: "1 Knob Build",
      amount_paid: 3.00,
      purchase_date: new Date().toISOString(),
      stripe_payment_id: "pi_test_make_" + Date.now(),
      source: "bohemyth_store_test",
    };

    console.log("Payload:", JSON.stringify(testPayload));

    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    console.log("Make.com Response status:", response.status);
    console.log("Make.com Response:", responseText);

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      payload: testPayload,
      makeResponse: responseText,
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
