-- Temporarily set all products to $1 for testing
UPDATE products 
SET price = '$1.00'
WHERE price != 'Free';