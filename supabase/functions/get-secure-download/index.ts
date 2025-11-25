import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - now using secure tokens
const requestSchema = z.object({
  token: z.string().min(32, { message: "Invalid token format" }).max(255, { message: "Token too long" })
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get token from query parameter
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate token format
    const validation = requestSchema.safeParse({ token });
    if (!validation.success) {
      console.error('Validation error:', validation.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid token format',
          details: validation.error.errors.map(e => e.message).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Secure download request with token');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token exists and is valid
    const { data: downloadToken, error: tokenError } = await supabase
      .from('download_tokens')
      .select('id, product_id, customer_email, expires_at, download_count, max_downloads')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('Token lookup error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify download token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!downloadToken) {
      console.log('Invalid token provided');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired download link. Please check your email for a new link.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(downloadToken.expires_at);
    if (now > expiresAt) {
      console.log('Token expired:', { expires_at: downloadToken.expires_at });
      return new Response(
        JSON.stringify({ error: 'Download link has expired. Please contact support for assistance.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check download limit
    if (downloadToken.download_count >= downloadToken.max_downloads) {
      console.log('Download limit reached:', { count: downloadToken.download_count, max: downloadToken.max_downloads });
      return new Response(
        JSON.stringify({ error: 'Download limit reached. Please contact support if you need additional downloads.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment download count
    const { error: updateError } = await supabase
      .from('download_tokens')
      .update({ download_count: downloadToken.download_count + 1 })
      .eq('id', downloadToken.id);

    if (updateError) {
      console.error('Error updating download count:', updateError);
      // Continue anyway - user should still get their download
    }

    // Fetch product download path from product_downloads table
    const { data: productDownload, error: downloadError } = await supabase
      .from('product_downloads')
      .select('download_path, download_url')
      .eq('product_id', downloadToken.product_id)
      .maybeSingle();

    if (downloadError) {
      console.error('Product download lookup error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve download information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!productDownload) {
      console.error('No download found for product:', downloadToken.product_id);
      return new Response(
        JSON.stringify({ error: 'Download not available for this product' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL if download_path exists (private bucket)
    let finalDownloadUrl = productDownload.download_url;
    
    if (productDownload.download_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from('product-downloads')
        .createSignedUrl(productDownload.download_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error('Error generating signed URL:', signedUrlError);
        // Fallback to download_url if signed URL generation fails
      } else if (signedUrlData?.signedUrl) {
        finalDownloadUrl = signedUrlData.signedUrl;
        console.log('Generated signed URL with 1-hour expiry');
      }
    }

    // Get product title for response
    const { data: product } = await supabase
      .from('products')
      .select('title')
      .eq('id', downloadToken.product_id)
      .single();

    console.log('Download authorized:', { 
      product_id: downloadToken.product_id, 
      downloads_remaining: downloadToken.max_downloads - downloadToken.download_count - 1 
    });

    return new Response(
      JSON.stringify({ 
        downloadUrl: finalDownloadUrl,
        productTitle: product?.title || 'Digital Product',
        downloadsRemaining: downloadToken.max_downloads - downloadToken.download_count - 1
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
