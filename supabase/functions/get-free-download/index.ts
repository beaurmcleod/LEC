import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate request body
const requestSchema = z.object({
  productId: z.string().uuid({ message: "Invalid product ID format" }),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation error:", parsed.error);
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: parsed.error.errors.map((e) => e.message),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { productId } = parsed.data;
    console.log("Free download request received", { productId });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("price, title")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      console.error("Product lookup error:", productError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch product" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!product) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawPrice = (product.price || "").toString().trim();
    const normalized = rawPrice.toLowerCase();
    const numeric = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
    const isFree = normalized === "free" || (!Number.isNaN(numeric) && numeric === 0);

    if (!isFree) {
      console.log("Product is not free, blocking free download", { productId, rawPrice });
      return new Response(
        JSON.stringify({ error: "Product is not free" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch product download path from product_downloads table
    const { data: productDownload, error: downloadError } = await supabase
      .from('product_downloads')
      .select('download_path, download_url')
      .eq('product_id', productId)
      .maybeSingle();

    if (downloadError) {
      console.error('Product download lookup error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve download information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!productDownload) {
      console.error('No download found for product:', productId);
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
        console.log('Generated signed URL for free download with 1-hour expiry');
      }
    }

    console.log("Granting free download", { title: product.title });

    return new Response(
      JSON.stringify({
        downloadUrl: finalDownloadUrl,
        productTitle: product.title,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in get-free-download:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});