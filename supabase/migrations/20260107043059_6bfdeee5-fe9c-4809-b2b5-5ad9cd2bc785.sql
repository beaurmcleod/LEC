-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'fixed_price', -- 'fixed_price', 'percentage', 'fixed_amount'
  discount_value NUMERIC NOT NULL, -- For fixed_price: the new price, percentage: 0-100, fixed_amount: amount off
  applies_to_all BOOLEAN NOT NULL DEFAULT true,
  product_ids UUID[] DEFAULT NULL, -- If applies_to_all is false, only these products
  max_uses INTEGER DEFAULT NULL, -- NULL = unlimited
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Public can check if a coupon is valid (read-only, limited info)
CREATE POLICY "Anyone can validate coupons"
ON public.coupons
FOR SELECT
USING (is_active = true);

-- Admins can manage coupons
CREATE POLICY "Admins can manage coupons"
ON public.coupons
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert the bohemythtest coupon
INSERT INTO public.coupons (code, discount_type, discount_value, applies_to_all, is_active)
VALUES ('bohemythtest', 'fixed_price', 0.25, true, true);