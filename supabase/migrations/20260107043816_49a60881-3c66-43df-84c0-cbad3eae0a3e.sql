-- Update the coupon code to uppercase for consistency
UPDATE public.coupons SET code = UPPER(code) WHERE code = 'bohemythtest';