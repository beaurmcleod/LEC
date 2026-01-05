import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const productUpdates = [
  {
    title: "Compressor Buddy",
    short_description: "See compression in real-time with this visual Ableton device",
    full_description: "Compression is often the hardest concept to master because it's hard to hear if you don't know what to listen for. Compressor Buddy solves that by letting you see it. This visual Ableton device displays exactly what the compression is doing to your audio in real-time. It's the perfect tool for learning dynamics or dialing in surgical control over your mix.",
    features: ["Real-time visual compression display", "Perfect for learning dynamics", "Dial in surgical control over your mix", "Max for Live device for Ableton"]
  },
  {
    title: "Key & BPM Finder",
    short_description: "Instantly identify the Key and BPM of any sample or loop",
    full_description: "Stop wasting time tapping on your desk. This tool instantly identifies the Key and BPM of any sample or loop. It is essential for quick mashups, remixing, and keeping your session organized so you can stay in the creative flow.",
    features: ["Instant Key detection", "Instant BPM detection", "Essential for mashups and remixing", "Keep your session organized", "Stay in the creative flow"]
  },
  {
    title: "1 Knob Build",
    short_description: "Create professional transitions with a single twist",
    full_description: "Create professional transitions with a single twist. This Ableton rack combines filtering, reverb wash, and delay throws into one macro knob. Automate it up before a drop, and bring it back down for the impact. It turns hours of automation lane editing into one simple movement.",
    features: ["Single macro knob control", "Combines filtering, reverb wash, and delay", "Perfect for transitions and drops", "Replaces hours of automation editing"]
  },
  {
    title: "HAAS Effect",
    short_description: "Instant stereo width using the psychoacoustic Haas effect",
    full_description: "Need instant width? This rack utilizes the psychoacoustic Haas effect to spread your mono signals across the stereo field. Perfect for guitars, synths, and background vocals that need to feel \"outside\" the speakers. We've tuned the delay times to ensure maximum width while minimizing phase cancellation.",
    features: ["Psychoacoustic Haas effect", "Spread mono signals to stereo", "Perfect for guitars, synths, and vocals", "Tuned for maximum width", "Minimizes phase cancellation"]
  },
  {
    title: "27 OTT Rack",
    short_description: "Stacked multiband compression madness for sound design",
    full_description: "You know the meme, now use the weapon. We stacked the multiband compression madness so you don't have to. This is a sound design powerhouse for creating metallic, hyper-compressed textures and neuro-bass growls. Warning: It gets loud.",
    features: ["Stacked multiband compression", "Sound design powerhouse", "Create metallic, hyper-compressed textures", "Perfect for neuro-bass growls", "Warning: It gets loud"]
  },
  {
    title: "Bohemyth's Serum (1) Rack",
    short_description: "Turn Serum into an instant inspiration generator",
    full_description: "Turn Serum into an instant inspiration generator. This is an Ableton rack that maps Serum's most vital controls to easy-access macros, paired with a powerful randomizer feature. With the click of a button, you can randomize the parameters to generate completely unique patches and textures instantly. Stop scrolling through presets and start creating your own sound.",
    features: ["Maps Serum controls to easy-access macros", "Powerful randomizer feature", "Generate unique patches instantly", "Stop scrolling through presets", "Create your own sound"]
  },
  {
    title: "Serum 2 Randomizer Rack",
    short_description: "Refined randomization engine for complex, usable sounds",
    full_description: "Take the randomization concept even further. Like our original Serum Rack, this device utilizes Ableton's macro capabilities to control Serum, but with a refined randomization engine. It's designed to force \"happy accidents,\" spitting out complex, usable sounds that you would never program manually. It is the ultimate cure for beat block.",
    features: ["Refined randomization engine", "Force happy accidents", "Complex, usable sounds", "Uses Ableton macro capabilities", "The ultimate cure for beat block"]
  },
  {
    title: "Vocal Clean Up Rack",
    short_description: "Your first step in the vocal chain for a clean signal",
    full_description: "Before you add the effects, you need a clean signal. This utility rack is your first step in the vocal chain. It includes surgical EQ to remove mud, a transparent gate to remove background noise, and a de-esser to tame harsh sibilance. Get your vocals pro-ready in seconds.",
    features: ["Surgical EQ to remove mud", "Transparent gate for background noise", "De-esser for harsh sibilance", "First step in vocal chain", "Pro-ready vocals in seconds"]
  },
  {
    title: "Vocal Sauce",
    short_description: "Creative polish to make your vocals shine",
    full_description: "This is the creative polish. Once your vocals are clean, throw Vocal Sauce on to make them shine. Packed with lush reverbs, stereo widening, and tasty saturation, this rack turns dry, boring recordings into professional, radio-ready anthems.",
    features: ["Lush reverbs", "Stereo widening", "Tasty saturation", "Turn dry recordings into anthems", "Professional, radio-ready sound"]
  },
  {
    title: "100 MIDI Arrangements",
    short_description: "Drag-and-drop MIDI arrangements for chords, melodies, and basslines",
    full_description: "We've composed 100 drag-and-drop MIDI arrangements covering chords, melodies, and basslines. Use them as song starters, study the theory behind them, or chop them up to create something entirely new. 100% Royalty-Free. Fully Customizable: Change the key, velocity, and timing to fit your track.",
    features: ["100 MIDI arrangements", "Chords, melodies, and basslines", "100% Royalty-Free", "Fully customizable", "Great for song starters or study"]
  },
  {
    title: "Hip Hop Sample Pack",
    short_description: "Hard-hitting kicks, snapping snares, and 808s that cut through",
    full_description: "Hard-hitting kicks, snapping snares, and 808s that cut through the mix. This pack contains over 100 curated samples designed for modern Hip Hop and Trap production. No fluff, just the essential sounds you need to build heavy beats instantly.",
    features: ["100+ curated samples", "Hard-hitting kicks and snares", "808s that cut through the mix", "Designed for Hip Hop and Trap", "Essential sounds, no fluff"]
  },
  {
    title: "Bohemyth's 1st Sample Pack",
    short_description: "Unique palette of signature sounds, textures, and foley",
    full_description: "The debut collection from Bohemyth. This pack offers a unique palette of signature sounds, textures, and foley that you won't find in generic packs. It's a direct injection of character into your library, perfect for adding organic depth to electronic productions.",
    features: ["Signature sounds and textures", "Unique foley samples", "Not found in generic packs", "Adds organic depth", "Perfect for electronic productions"]
  },
  {
    title: "Deep House Ableton Project File",
    short_description: "Full Ableton project file from the Deep House tutorial",
    full_description: "Reverse engineer the magic. This is the full Ableton Live project file from our Deep House tutorial. See exactly how the drums were processed, how the synths were layered, and how the mix was balanced. It's not just a template; it's an interactive lesson in arrangement and mixing.",
    features: ["Full Ableton Live project file", "From the YouTube tutorial", "See drum processing and synth layering", "Learn arrangement and mixing", "Interactive lesson, not just a template"]
  }
];

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Skip auth check - this is an admin utility function
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = [];

    for (const product of productUpdates) {
      const { data, error } = await supabase
        .from("products")
        .update({
          short_description: product.short_description,
          full_description: product.full_description,
          features: product.features,
        })
        .eq("title", product.title)
        .select()
        .single();

      if (error) {
        results.push({ title: product.title, status: "error", error: error.message });
      } else if (data) {
        results.push({ title: product.title, status: "updated" });
      } else {
        results.push({ title: product.title, status: "not found" });
      }
    }

    return new Response(
      JSON.stringify({ message: "Products updated", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
