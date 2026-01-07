-- Remove public SELECT access to coupons table
-- Coupon validation now happens server-side only via edge functions

DROP POLICY IF EXISTS "Anyone can validate coupons" ON public.coupons;