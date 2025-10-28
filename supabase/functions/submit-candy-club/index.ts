import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandyClubSubmission {
  firstName: string;
  lastName: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email }: CandyClubSubmission = await req.json();

    console.log("Received submission:", { firstName, lastName, email });

    // Send to LeadConnector webhook
    const webhookUrl = "https://services.leadconnectorhq.com/hooks/84LVJ79Hb6dDlqcCFKVc/webhook-trigger/0904dc76-e3fe-4d39-8c29-a36fac891ca1";
    
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log("Webhook response status:", webhookResponse.status);
    const responseText = await webhookResponse.text();
    console.log("Webhook response body:", responseText);

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed with status ${webhookResponse.status}: ${responseText}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Successfully submitted to Candy Club",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-candy-club:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
