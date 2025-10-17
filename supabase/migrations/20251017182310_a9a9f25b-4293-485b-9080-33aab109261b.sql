-- Delete duplicate products (newer entries created at 19:48:11)
DELETE FROM products WHERE created_at = '2025-10-15 19:48:11.79928+00';

-- Update prices for the remaining products
UPDATE products SET price = '$3.00' WHERE title = '1 Knob Build';
UPDATE products SET price = '$3.00' WHERE title = 'Hat Sauce';
UPDATE products SET price = '$3.00' WHERE title = 'Bohemyth''s Serum (1) Rack';
UPDATE products SET price = '$5.00' WHERE title = 'Vocal Clean Up Rack';
UPDATE products SET price = '$3.00' WHERE title = 'Vocal Sauce';
UPDATE products SET price = '$5.00' WHERE title = 'Serum 2 Randomizer Rack';