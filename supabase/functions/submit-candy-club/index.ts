import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (per IP, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // Max submissions per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return false;
  }
  
  if (record.count >= RATE_LIMIT) {
    return true;
  }
  
  record.count++;
  return false;
}

// Input validation
function validateInput(data: unknown): { valid: boolean; error?: string; sanitized?: { firstName: string; lastName: string; email: string } } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { firstName, lastName, email } = data as Record<string, unknown>;

  // Validate firstName
  if (typeof firstName !== 'string' || firstName.trim().length === 0) {
    return { valid: false, error: 'First name is required' };
  }
  if (firstName.length > 50) {
    return { valid: false, error: 'First name must be 50 characters or less' };
  }
  // Only allow letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'\-]+$/;
  if (!nameRegex.test(firstName)) {
    return { valid: false, error: 'First name contains invalid characters' };
  }

  // Validate lastName
  if (typeof lastName !== 'string' || lastName.trim().length === 0) {
    return { valid: false, error: 'Last name is required' };
  }
  if (lastName.length > 50) {
    return { valid: false, error: 'Last name must be 50 characters or less' };
  }
  if (!nameRegex.test(lastName)) {
    return { valid: false, error: 'Last name contains invalid characters' };
  }

  // Validate email
  if (typeof email !== 'string' || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  if (email.length > 255) {
    return { valid: false, error: 'Email must be 255 characters or less' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email address' };
  }

  return {
    valid: true,
    sanitized: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
    },
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (isRateLimited(clientIP)) {
      console.log("Rate limit exceeded for IP:", clientIP);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Too many requests. Please try again later.' 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate input
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validation = validateInput(requestBody);
    if (!validation.valid || !validation.sanitized) {
      console.log("Validation failed:", validation.error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: validation.error 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { firstName, lastName, email } = validation.sanitized;
    console.log("Validated submission:", { firstName, lastName, email: email.substring(0, 3) + '***' });

    // Send to LeadConnector webhook
    const webhookUrl = "https://services.leadconnectorhq.com/hooks/84LVJ79Hb6dDlqcCFKVc/webhook-trigger/0904dc76-e3fe-4d39-8c29-a36fac891ca1";
    
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log("Webhook response status:", webhookResponse.status);

    if (!webhookResponse.ok) {
      const responseText = await webhookResponse.text();
      console.error("Webhook failed:", responseText);
      throw new Error(`Webhook failed with status ${webhookResponse.status}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Successfully submitted to Candy Club",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in submit-candy-club:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'An error occurred. Please try again.' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
