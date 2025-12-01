import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting manual email send for Key & BPM Finder customers");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Send to specific customer
    const customers = [
      { email: "beaurmcleod@gmail.com", token: "2792a5e4-a17c-4ca1-9b12-1873b01c4aab" }
    ];

    const results = [];

    for (const customer of customers) {
      console.log(`Sending email to: ${customer.email}`);
      
      // Call send-purchase-email function
      const { data, error } = await supabase.functions.invoke("send-purchase-email", {
        body: {
          to: customer.email,
          productTitle: "Key & BPM Finder",
          amount: 14.99,
          paymentIntentId: "manual-resend",
          productId: "8fbb3028-e57f-4e44-91ab-44f9229aaf8f",
          downloadToken: customer.token,
        },
      });

      if (error) {
        console.error(`Error sending to ${customer.email}:`, error);
        results.push({ email: customer.email, success: false, error: error.message });
      } else {
        console.log(`Successfully sent to ${customer.email}`);
        results.push({ email: customer.email, success: true });
      }
    }

    return new Response(JSON.stringify({ 
      message: "Email send complete",
      results 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("Error in manual-send-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});