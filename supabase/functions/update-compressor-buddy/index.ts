import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("products")
      .update({
        price: "7",
        image: "/lovable-uploads/compressor-buddy-new.png",
        short_description: "Real-time waveform display to visualize compression",
        full_description: "Place Compressor Buddy after any compressor to get a visual display of the waveform and see exactly what the compression is doing to it in real time. Watch your transients get tamed, see the gain reduction in action, and finally understand what all those knobs are actually doing to your sound. Perfect for learning compression or dialing in the perfect settings.",
        features: [
          "Real-time waveform visualization",
          "Place after any compressor to see its effect",
          "Visual feedback of compression in action",
          "Great for learning and understanding compression",
          "Max for Live device for Ableton"
        ],
      })
      .eq("title", "Compressor Buddy")
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Product updated", product: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
