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

    // Check if product already exists
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("title", "Compressor Buddy")
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ message: "Product already exists", product: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the new product
    const { data, error } = await supabase.from("products").insert({
      title: "Compressor Buddy",
      price: "5",
      image: "/lovable-uploads/compressor-buddy.png",
      category: "Racks",
      short_description: "Visual waveform display for compression analysis",
      full_description: "Place this Max for Live device after any compressor to see a real-time visual display of the waveform and exactly what the compression is doing to it. Perfect for learning compression, fine-tuning your settings, and understanding gain reduction in real time.",
      features: [
        "Real-time waveform visualization",
        "Place after any compressor",
        "See compression in action",
        "Perfect for learning and fine-tuning",
        "Max for Live device"
      ],
      is_on_sale: false,
    }).select().single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Product added successfully", product: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
