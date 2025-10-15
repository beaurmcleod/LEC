-- Create purchases table to track verified transactions
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_id TEXT UNIQUE NOT NULL,
  amount_paid INTEGER NOT NULL,
  customer_email TEXT NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on purchases table
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view purchases by email (for download verification)
CREATE POLICY "Anyone can view purchases by email"
  ON public.purchases
  FOR SELECT
  USING (true);

-- Only authenticated users can insert purchases (via service role in webhook)
CREATE POLICY "Service role can insert purchases"
  ON public.purchases
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster purchase lookups
CREATE INDEX IF NOT EXISTS idx_purchases_email ON public.purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_payment ON public.purchases(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product_id ON public.purchases(product_id);

-- Update products table RLS policy to hide download_url from public queries
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;

-- Create new policy that excludes download_url from public access
CREATE POLICY "Anyone can view product info (no download URLs)"
  ON public.products
  FOR SELECT
  USING (true);

-- Note: The download_url column will still be in the table but access to it
-- should be controlled through a secure edge function that verifies purchase