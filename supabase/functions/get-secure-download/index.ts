import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productId, customerEmail } = await req.json();

    console.log('Secure download request:', { productId, customerEmail });

    // Validate input
    if (!productId || !customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing productId or customerEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify purchase exists
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, product_id, customer_email')
      .eq('product_id', productId)
      .eq('customer_email', customerEmail)
      .maybeSingle();

    if (purchaseError) {
      console.error('Purchase lookup error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify purchase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!purchase) {
      console.log('No purchase found for:', { productId, customerEmail });
      return new Response(
        JSON.stringify({ error: 'Purchase not found. Please complete payment first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch product download URL
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('download_url, title')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('Product lookup error:', productError);
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Download authorized for:', { productId, title: product.title });

    return new Response(
      JSON.stringify({ 
        downloadUrl: product.download_url,
        productTitle: product.title 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-secure-download:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
