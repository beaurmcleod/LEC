import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/84LVJ79Hb6dDlqcCFKVc/webhook-trigger/8dc2462a-0a56-47e8-99f8-247082fd8dae";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const testPayload = {
      email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      product_title: "Test Product - Sample Pack",
      amount_paid: 29.99,
      purchase_date: new Date().toISOString(),
      stripe_payment_id: "pi_test_sample_123456",
      source: "bohemyth_store_test",
    };

    console.log("Sending test payload to GHL:", testPayload);

    const response = await fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    console.log("GHL response status:", response.status);
    console.log("GHL response body:", responseText);

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      payload_sent: testPayload,
      ghl_response: responseText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error sending to GHL:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
