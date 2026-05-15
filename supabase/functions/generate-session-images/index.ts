import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, isAdminOrServiceRole, unauthorized } from "../_shared/auth-guard.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SessionImageConfig {
  productId: string;
  title: string;
  prompt: string;
}

const sessionProducts: SessionImageConfig[] = [
  {
    productId: '1-hour-session',
    title: '1 Hour Session',
    prompt: `Create a premium digital product image for a music production mentorship session. 
    Style: Dark obsidian purple background (#1a0d1f to #2d1f3d gradient). 
    Central element: A sleek, modern stopwatch or clock showing "60" with glowing candy yellow (#FFD700) neon outline.
    Accents: Swirling candy lollipop spiral elements in hot pink (#FF1493) and yellow emanating from the clock.
    Text overlay: "1 HOUR" in bold, modern sans-serif font with yellow glow effect.
    Additional elements: Musical notes, waveform patterns, and subtle sparkle effects.
    Mood: Premium, energetic, professional music production vibes.
    Square format, 1024x1024, clean and modern design.`
  },
  {
    productId: '2-hour-session',
    title: '2 Hour Session',
    prompt: `Create a premium digital product image for an extended music production mentorship session.
    Style: Deep obsidian purple background (#1a0d1f to #2d1f3d gradient).
    Central element: Two interconnected modern clocks or a dual-dial timepiece showing "120" with glowing hot pink (#FF1493) and candy yellow (#FFD700) neon outlines.
    Accents: Double helix candy swirl patterns in pink and yellow, representing the extended session time.
    Text overlay: "2 HOURS" in bold, modern typography with pink-to-yellow gradient glow.
    Additional elements: Audio waveforms, equalizer bars, and premium sparkle effects.
    Badge: Small "MOST POPULAR" or star badge element.
    Mood: Premium, professional, value-focused music production experience.
    Square format, 1024x1024, clean and modern design.`
  },
  {
    productId: '4-lesson-pack',
    title: '4 Lesson Pack',
    prompt: `Create a premium digital product image for a music production lesson bundle package.
    Style: Rich obsidian purple background (#1a0d1f to #2d1f3d gradient) with subtle gold accents.
    Central element: Four stacked or fanned lesson cards/tickets with candy-themed decorative edges, each with a lollipop or candy motif.
    Color scheme: Gold/yellow (#FFD700) as primary accent with hot pink (#FF1493) highlights.
    Text overlay: "4 LESSONS" in premium gold typography with shine effect.
    Additional elements: Crown or premium badge indicating "BEST VALUE", musical notes, and confetti-like candy sprinkles.
    Ribbon or banner element with savings messaging.
    Mood: Premium bundle, exclusive offer, professional music education package.
    Square format, 1024x1024, luxurious and modern design.`
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isAdminOrServiceRole(req))) return unauthorized("Admin access required");

  try {
    const { productIndex } = await req.json();
    
    if (!lovableApiKey) {
      throw new Error('Lovable API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the specific product to generate, or generate all
    const productsToGenerate = productIndex !== undefined 
      ? [sessionProducts[productIndex]] 
      : sessionProducts;

    const results = [];

    for (const product of productsToGenerate) {
      console.log(`Generating image for: ${product.title}`);
      
      // Generate image using Lovable AI Gateway with Gemini image model
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: product.prompt
            }
          ],
          modalities: ['image', 'text']
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Lovable AI API error for ${product.title}:`, errorData);
        throw new Error(`Failed to generate image for ${product.title}: ${errorData}`);
      }

      const data = await response.json();
      console.log(`Image generated successfully for: ${product.title}`);
      
      // Get the base64 image from the response
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageUrl || !imageUrl.startsWith('data:image')) {
        throw new Error(`No image returned for ${product.title}`);
      }
      
      // Extract base64 data from data URL
      const base64Data = imageUrl.split(',')[1];
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Upload to Supabase Storage
      const fileName = `session-images/${product.productId}-${Date.now()}.png`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-downloads')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for ${product.title}:`, uploadError);
        throw new Error(`Failed to upload image for ${product.title}: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-downloads')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      console.log(`Image uploaded for ${product.title}: ${publicUrl}`);

      results.push({
        title: product.title,
        productId: product.productId,
        imageUrl: publicUrl,
        storagePath: fileName,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      message: `Generated ${results.length} session product images` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-session-images:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
