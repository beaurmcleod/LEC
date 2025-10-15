import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  productId: z.string().uuid({ message: "Invalid product ID format" }),
  customerEmail: z.string().email({ message: "Invalid email format" }).max(255, { message: "Email too long" })
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate and parse input with zod
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => e.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productId, customerEmail } = validation.data;
    console.log('Secure download request:', { productId, customerEmail });

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
