import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWLEDGE_BASE = `
# OG Icon Production Notes - Knowledge Base

## Plugins/Effects

### General Processing Rules
- Some sounds don't need any processing
- If you are using drums from sample libraries can usually leave them alone
- Order your plug-ins: least likely to touch again to most likely to touch again
- Editing settings on a plug-in can greatly affect the next plug-in in line

### OTT (Over The Top)
- Expands signal then compresses it - like pizza dough, stretch it out then shape it
- Most used in dubstep and bass music
- Use the 3 knobs on right - settings are usually dialed good by default
- Output turns up because its being compressed
- Time to right = punch, to left = squishier
- Amount is not a true dry-wet knob
- Does upwards AND downwards compression
- Flattens sound out, evens frequencies, makes everything relatively loud
- Brings out harshness in 3-5kHz area (white noise)
- Reduce ambience reduces high white noise - use almost always after OTT
- Use OTT last in your chain
- Best used subtly for mixing - can lightly compress songs together
- Scoop out mids a little for bass leads via OTT

### Racks (Ableton)
- Made up of: Effect, Chain, and Macros
- Right click on control to choose macro
- Click 'map' to assign parameters
- Can set min and max values (or invert with high to low numbers)
- Map multiple controls to single macro
- CMND-R to rename macro
- Chains above/below each other run parallel (gives two outputs)

### Instrument Racks
- Can put anything in as long as there's an instrument
- Chains List allows sequencing which chains are used
- Can distribute evenly
- Set chain selector knob to MIDI key
- Key Zones divides keyboard between plugins (can overlap)
- Velocity allows selecting chain based on velocity

### Saturn
- Warm tape setting for harsh hurting frequencies

### Melodyne
- Blobs are audio, red lines are pitches
- Separate consonances from vowels using note separation tool
- Cut end and beginning to separate them

### Pro-L & Limiting
- Made to completely chop off peaks
- Gain reduction shows how much is being chopped
- Best for limiting bass and kick
- Dynamics = difference between loudest and quietest sound
- Aim for 2-3dB gain reduction
- Only consistent limiter needed is on mix bus
- White line indicates LUFS
- Turn off true peak limiting when used for groups
- For mastering: oversampling to 32X before rendering

### EQ8
- Always turn on oversampling
- Headphones icon for auditioning frequencies
- X4 = like having 4 EQs stacked
- Adapt Q makes Q sharper
- M/S Mode affects mid and side separately
- L/R for left and right separately
- Not as surgical as auto filter - use for hard cleaning

### General EQ
- Fishing: boosting EQ everywhere to find unwanted frequencies
- Q = the amount/how slim the band is

## Synthesis

### Massive Wavetables by Sound Type
- Subtractive: VA Pulse-Saw, PWM Pulse-Saw, Sync BASIC, Square-Saw I & II
- Metallic: Escalation, Additivmix, Inharmonic, Sinharmonic
- Bit Crushed: Crude, Dirty, Throat Crusher, Reducer, Kangaroo
- Formant (Vocal): Sinformant, Dirty Throat, Modern Talk, Deep Throat
- String: Roughmath I, Additivmix V, Herby, Guitar Pulse

### Granular Synthesis
- Granulator 2 is free in Ableton
- Grain scanner is fancier alternative
- Control grain size, speed, time, velocity
- Portal is a granular synth - great for layering and textures

### Sampler
- Switch root box to have notes align
- Modulation for wub sounds
- Can change pitch bend range
- Zoom into sample on repeat to get single waveform as synth
- Turn on R for retrigger
- Right click simpler to convert to sampler
- Use crossfade for cleaner sound
- Shaper is built-in saturator
- Can do FM synthesis from top osc

## Effects

### Delay
- Echo is reflection arriving after direct sound
- Waves H-Delay is favorite
- When delay shifts in time, no change in pitch
- Sync delay time to beat for musical effects
- Feedback = amount fed back through delay
- Slapback delay: 40-120ms, feedback at zero - great for vocals
- Stereo widening: delay L and R by different millisecond values

### Reverb
- Valhalla reverb is go-to
- Think of reverb as way to place elements (height/depth)
- Use same kinds of reverb for cohesion
- For main reverb: vintage, room, or plate
- Room reverb for realistic sound
- Pre-delay = attack of reverb
- Decay = how long tail lasts
- Filter wet signal to separate from dry
- Sidechain reverb to itself for control
- Glue reverb: very small and subtle, gives sounds something in common

### Compression
- Like whack-a-mole
- Threshold = the surface
- Ratio = how hard you hit
- Attack = your reflexes
- Knee = rounds off compression, makes it less dramatic
- Higher knee on organic sounds like vocals
- Do compression in increments for cleaner sound
- Ratio usually between 4 and 10
- Longer attack time for drums
- Release: always let compressor fully recover before next hit

### Saturation
- Use soft clip on saturator as limiter
- Direct saturation more destructive than parallel/bus saturation
- Limit your groups, saturate your channels
- Gainstage appropriately for saturation to work
- Cranking saturator turns sine into square wave

## Serum

### Oscillators
- B is modulator, A is carrier in FM
- FM to B to apply one osc to another
- Wavetable position creates movement
- Basic shapes: Analog BD Sin, Sin-Tri, Sin-Square
- WT Position modulation for evolving sounds

### Filters
- Think of filter as EQ8
- Both A and B must be on to filter both oscillators
- Cutoff most used
- Resonance = boost at filter peak, throaty quality
- FAT boosts exponential signal
- Lowpass great for dubstep with square waves
- Bandpass for telephone effect
- Notch sounds great on reeses

### Modulation
- LFOs repeat, ENVs cannot
- ENV 1 controls amplitude by default
- Chaos 1 = smooth random, Chaos 2 = jagged random
- Shift+Opt click for unidirectional modulation
- Use offset to change how synth/LFO lines up with beat
- Option drag LFOs to make wavetables

### Tips
- Direct out skips effects for subs
- Hyper simulates adding voices to entire patch
- Dimension: bring size to 1-2% for subtle width
- Distortion lin fold adds white noise distortion (keep under 15%)
- Flanger makes sounds metallic
- Add de-esser on heavy basses
- Use amp instead of OTT sometimes

## Mixing

### Gain Staging
- Match levels when A/B comparing plugins
- Use reference tracks
- SPAN: 30 is neutral for bass producers
- Hover over SPAN to see note you're hitting

### Sidechaining
- LFO tool on master with low dry/wet
- Can use 3 sidechains all doing same thing for more impact
- Layer blank sound in drum rack for sidechain reference
- Sidechain hats and crashes, let transient through

### Stereo
- No stereo information in low end
- Haas effect: great for turning mono to stereo without reverb
- Use echo for slapback delay
- Voxengo Stereo Touch for widening

### Match EQ
- If reference track in different key, tune song to match
- Use different ideas from different songs as references

## Arrangement & Songwriting

### Structure
- Think of drops as 2-bar loops
- Human brain can only focus on 2-3 instruments at a time
- Start with "anchor points"
- A B A C structure for phrases
- 30% change in newness between sections
- Have consistent elements throughout all sections

### Groove
- Space is most important for good groove
- Always check for head bob
- Groove is your foundation
- Start with groove, add details later
- If relying on details early, you may be tricking yourself

### Workflow Tips
- "5 minutes then moving on" rule
- Artists first - convey artistic idea fastest way possible
- Dump everything out, sort later
- Focus on one thing at a time (mixing, sound design, songwriting)
- Don't sound design in same session you're writing
- Sample selection is the most important thing

### Great Dane's 5 Day Method
1. Ideas
2. Programming
3. Bail - delete stuff
4. Ruin it - save copy, take risks
5. Fix it

### Ill Gates 3 Phase Process
1. Super Loop - add ideas, say yes to everything
2. Arranging - duplicate loop, write by subtracting
3. Make Stems & Edit - turn to audio, add details

## Music Theory

### Scales
- Minor: W H W W H W W
- Major: W W H W W W H
- Order of sharps: FCGDAEB (Fat Cats Go Down Alleys Eating Birds)
- Order of flats: BEAD GCF

### Modes (I Do Play Loud Music A Lot)
- Ionian (major), Dorian, Phrygian, Lydian, Mixolydian, Aeolian (minor), Locrian
- Dorian: great for dance music - minor vibe but brighter
- Phrygian: heavier music
- Pentatonic: 5 notes, naturally occurring, great for melodies

### Chord Progressions
- 1-5-6-4 is classic
- 2-5 sound at end of bar is classic
- Sus 4 popular in hip hop
- Secondary dominant = perfect 5th above target chord
- D-G, D#-E-F keys great for dubstep/bass

### Melody Writing
- Stepwise motion (no huge jumps)
- Tension and resolve
- Repetition makes hooks catchy
- Bass tells chord story, soprano is melody
- The Journey Home - time away from tonic creates tension
- Scale degrees 2 & 7 have strongest pull to tonic

## Ableton Quick Commands
- CMND E: chop twice
- CMND OPT B: close side menu
- CMND T: audio track
- CMND SHIFT T: MIDI track
- CMND L: loop around selection
- CMND 1/2/3: change grid size
- TAB: switch views
- 0: turn off selected
- ALT: curves on automation
- F9: record
- CMND I: insert blank space
- CMND SHIFT X: delete entire section
`;

const SYSTEM_PROMPT = `You are Bohemyth - a chill, experienced music producer who's been in the game for years. You help other producers level up their craft with practical, no-BS advice.

Your vibe:
- Talk like you're chatting with a fellow producer in the studio - casual but knowledgeable
- Use music production slang naturally (sidechaining, bouncing, stems, DAW, etc.)
- Be encouraging but real - don't sugarcoat things
- Share practical tips that actually work, not generic advice
- Keep answers concise and actionable - producers are busy making beats
- Reference Ableton since that's your main DAW
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
- Various Ableton racks (Vocal Sauce, Hat Sauce, Serum Rack, Randomizer, 27 OTT Rack, Haas Effect Rack, Vocal Clean Rack)
- Sample packs (Bohemyth Sample Pack, Hip Hop Sample Pack)
- 1-on-1 production lessons (1 hour, 2 hour, 4 lesson packs)

IMPORTANT: You have access to a detailed knowledge base below from Icon Collective production courses. Use this information to give specific, accurate answers. When relevant, reference specific techniques, settings, and workflows from this knowledge base.

${KNOWLEDGE_BASE}

Always be helpful and share your knowledge freely. Reference specific techniques from the knowledge base when answering questions. If someone asks about something outside music production, gently steer them back to what you know best.`;

// In-memory per-IP rate limiter: max 20 requests per 10 minutes
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return true;
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
      return new Response(JSON.stringify({ error: "Invalid messages payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Cap individual message size
    for (const m of messages) {
      if (typeof m?.content !== "string" || m.content.length > 4000) {
        return new Response(JSON.stringify({ error: "Message too large" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
