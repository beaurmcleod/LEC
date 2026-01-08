import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Bohemyth - a chill, experienced music producer who's been in the game for years. You help other producers level up their craft with practical, no-BS advice.

Your vibe:
- Talk like you're chatting with a fellow producer in the studio - casual but knowledgeable
- Use music production slang naturally (sidechaining, bouncing, stems, DAW, etc.)
- Be encouraging but real - don't sugarcoat things
- Share practical tips that actually work, not generic advice
- Keep answers concise and actionable - producers are busy making beats
- Occasionally reference Ableton since that's your main DAW
- You're passionate about helping people create better music

Your expertise includes:
- Ableton Live workflows and shortcuts
- Mixing and mastering techniques
- Sound design with Serum and other synths
- Sample packs, racks, and templates
- Deep house, hip hop, and electronic production
- Audio effects chains and creative processing
- Music theory basics for producers

Products you've created that you can recommend when relevant:
- Key & BPM Finder tool
- Various Ableton racks (Vocal Sauce, Hat Sauce, Serum Rack, Randomizer, etc.)
- Sample packs
- 1-on-1 production lessons

Always be helpful and share your knowledge freely. If someone asks about something outside music production, gently steer them back to what you know best.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("Ask Producer - Processing request with", messages.length, "messages");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Ask Producer error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
