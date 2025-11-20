import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if product already exists
    const { data: existing } = await supabaseClient
      .from('products')
      .select('id')
      .eq('title', 'Key & BPM Finder')
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: 'Product already exists', product: existing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the Key & BPM Finder product
    const { data, error } = await supabaseClient
      .from('products')
      .insert({
        title: 'Key & BPM Finder',
        price: '14.99',
        image: '/lovable-uploads/key-bpm-finder.png',
        category: 'Tools',
        short_description: 'Instantly analyze your audio files to find key and BPM',
        full_description: 'The Key & BPM Finder is an essential tool for every producer. Simply drop your audio file and get instant analysis of the musical key, relative key, and BPM. Perfect for organizing your sample library, matching tracks for DJ sets, or finding compatible elements for your productions.',
        features: [
          'Instant key detection',
          'BPM analysis',
          'Relative key finder',
          'Supports WAV files',
          'Easy drag & drop interface'
        ],
        created_at: '2025-10-15 19:00:00.000000+00'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, product: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
