-- Create download_tokens table for secure, time-limited download access
CREATE TABLE IF NOT EXISTS public.download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.download_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can manage tokens (for webhook creation)
CREATE POLICY "Service role can manage download tokens"
ON public.download_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast token lookup
CREATE INDEX idx_download_tokens_token ON public.download_tokens(token);
CREATE INDEX idx_download_tokens_expires_at ON public.download_tokens(expires_at);

-- Add download_path column to product_downloads table (for private bucket paths)
ALTER TABLE public.product_downloads 
ADD COLUMN IF NOT EXISTS download_path TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_download_tokens_updated_at
  BEFORE UPDATE ON public.download_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();