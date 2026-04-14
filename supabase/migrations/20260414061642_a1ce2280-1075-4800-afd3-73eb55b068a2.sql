INSERT INTO public.coupons (code, discount_type, discount_value, applies_to_all, is_active)
VALUES ('BOHEMYTHFREE', 'fixed_price', 0, true, true)
ON CONFLICT DO NOTHING;