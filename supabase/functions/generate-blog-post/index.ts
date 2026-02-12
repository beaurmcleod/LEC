import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOPICS = [
  "Latest Ableton Live tips and hidden features producers don't know about",
  "New music production techniques trending in electronic music",
  "How to improve your mixing and mastering workflow in Ableton",
  "Sound design tutorials for modern electronic genres like house, techno, and bass music",
  "Music theory concepts every beat maker should understand",
  "The best new VST plugins and instruments released recently",
  "How to build a home studio on a budget in 2026",
  "Creative sampling techniques and sample manipulation tips",
  "Music production mindset, productivity, and finishing tracks",
  "Live performance tips using Ableton Live and controllers like Push",
  "Audio engineering fundamentals for bedroom producers",
  "How to get your music heard: distribution, marketing, and branding for producers",
  "Ableton Max for Live device creation and creative uses",
  "Deep dive into compression, EQ, and dynamics processing",
  "Synthesis deep dives: FM, granular, additive, and physical modeling",
  "Genre-specific production breakdowns: lo-fi, drill, afrobeats, DnB",
  "Recording and processing vocals in Ableton Live",
  "Collaboration tools and remote music production workflows",
  "Music production hardware reviews and comparisons",
  "Automation and modulation techniques for more expressive productions",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pick a random topic
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

    // Check how many posts exist to avoid duplicate slugs
    const { count } = await supabase.from("blog_posts").select("*", { count: "exact", head: true });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a professional music production blogger writing for Low End Candy, an Ableton Live resource site. Write engaging, SEO-optimized blog posts that are informative, actionable, and use a conversational but knowledgeable tone. Posts should be 800-1200 words.

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact schema:
{
  "slug": "kebab-case-url-slug-max-6-words",
  "title": "SEO Optimized Title Under 60 Characters",
  "excerpt": "Compelling 1-2 sentence excerpt under 160 characters",
  "meta_description": "SEO meta description under 160 characters with main keyword",
  "tags": ["Tag1", "Tag2", "Tag3"],
  "read_time": "X min read",
  "content": "Full blog post content using markdown with ## for h2, ### for h3, **bold**, - for lists, and numbered lists. Use double newlines between paragraphs/sections."
}`
          },
          {
            role: "user",
            content: `Write a blog post about: ${topic}. Make it fresh, practical, and include specific actionable advice. Focus on what's current in 2026. Post number ${(count || 0) + 1}.`
          }
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No content from AI");

    // Parse JSON, stripping code fences if present
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const post = JSON.parse(cleaned);

    // Ensure unique slug
    const slug = `${post.slug}-${Date.now().toString(36)}`;

    const { error: insertError } = await supabase.from("blog_posts").insert({
      slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      meta_description: post.meta_description,
      tags: post.tags,
      read_time: post.read_time,
      published_at: new Date().toISOString(),
    });

    if (insertError) throw new Error(`Insert error: ${insertError.message}`);

    console.log(`Blog post generated: ${post.title}`);
    return new Response(JSON.stringify({ success: true, slug, title: post.title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-blog-post error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
