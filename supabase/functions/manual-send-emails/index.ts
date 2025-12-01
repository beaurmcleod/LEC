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

    // Get the three paid customers and their tokens
    const customers = [
      { email: "daniel.r.j.salazar@gmail.com", token: "bccba0e2-3593-4eb9-8a3e-bf10b54dff4f-mif990l2" },
      { email: "brandonbvrke@gmail.com", token: "72f3b974-a9b8-4aa7-a8d2-8043869f32ac-mif3blce" },
      { email: "cantadora12345@gmail.com", token: "f67f4970-f8a7-492d-87d6-b5948e628d61-mieudba7" }
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