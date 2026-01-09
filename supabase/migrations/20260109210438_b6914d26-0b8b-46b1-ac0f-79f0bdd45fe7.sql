UPDATE coupons 
SET discount_value = 0.50, updated_at = now() 
WHERE UPPER(code) = 'BOHEMYTHTEST';