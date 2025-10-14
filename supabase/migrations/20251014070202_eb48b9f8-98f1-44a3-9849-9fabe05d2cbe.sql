-- Create the handle_updated_at function first
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  price TEXT NOT NULL,
  original_price TEXT,
  image TEXT NOT NULL,
  category TEXT NOT NULL,
  bpm TEXT,
  key TEXT,
  is_on_sale BOOLEAN DEFAULT false,
  short_description TEXT,
  full_description TEXT,
  features TEXT[],
  download_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view products
CREATE POLICY "Anyone can view products"
ON public.products
FOR SELECT
USING (true);

-- Only authenticated users can insert products (for admin functionality later)
CREATE POLICY "Authenticated users can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only authenticated users can update products
CREATE POLICY "Authenticated users can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (true);

-- Only authenticated users can delete products
CREATE POLICY "Authenticated users can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();