INSERT INTO coupons (code, discount_type, discount_value, applies_to_all, product_ids, is_active)
VALUES (
  'LEGACYSTUDENT',
  'fixed_amount',
  50,
  false,
  ARRAY['78ec84c6-1fef-4a1b-833e-abb9039b9298', '4ddb3517-4204-4b51-9625-6d6861181eb1']::uuid[],
  true
);