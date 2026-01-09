import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

// Validate request body
const requestSchema = z.object({
  productId: z.string().uuid({ message: "Invalid product ID format" }),
});

// Helper function to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

// Rate limiting check using database
async function checkRateLimit(supabase: any, ip: string, endpoint: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Count recent requests from this IP
  const { count, error } = await supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .eq("endpoint", endpoint)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check error:", error);
    return true; // Allow on error to prevent blocking legitimate users
  }

  return (count || 0) < MAX_REQUESTS_PER_WINDOW;
}

// Log rate limit request
async function logRateLimitRequest(supabase: any, ip: string, endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("rate_limit_log")
    .insert({ ip_address: ip, endpoint });
  
  if (error) {
    console.error("Rate limit log error:", error);
  }
}

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
    const clientIP = getClientIP(req);
    console.log("Free download request received", { productId, clientIP });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const withinLimit = await checkRateLimit(supabase, clientIP, "get-free-download");
    if (!withinLimit) {
      console.log("Rate limit exceeded for IP:", clientIP);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log this request for rate limiting
    await logRateLimitRequest(supabase, clientIP, "get-free-download");

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
      .select('download_path')
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

    // Require download_path for secure signed URL generation
    if (!productDownload.download_path) {
      console.error('No secure download path configured for product:', productId);
      return new Response(
        JSON.stringify({ error: 'Secure download not configured for this product' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed URL from private bucket (required - no fallback)
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('product-downloads')
      .createSignedUrl(productDownload.download_path, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error generating signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate secure download link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Granting free download with secure signed URL", { title: product.title });

    return new Response(
      JSON.stringify({
        downloadUrl: signedUrlData.signedUrl,
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
