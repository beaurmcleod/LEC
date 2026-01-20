INSERT INTO public.coupons (code, discount_type, discount_value, applies_to_all, product_ids, is_active)
VALUES (
  'JAN2025',
  'percentage',
  25,
  false,
  ARRAY['78ec84c6-1fef-4a1b-833e-abb9039b9298'::uuid, '4ddb3517-4204-4b51-9625-6d6861181eb1'::uuid, 'ed2732f3-a006-4dc6-a9f3-d07f75111e0f'::uuid],
  true
)