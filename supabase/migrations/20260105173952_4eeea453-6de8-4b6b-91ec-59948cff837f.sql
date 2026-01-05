-- Insert the new 100 MIDI Arrangements product
INSERT INTO products (title, price, image, category, short_description, full_description, features)
VALUES (
  '100 MIDI Arrangements',
  '5',
  '/lovable-uploads/100-midi-arrangements.png',
  'MIDI',
  '100 professionally crafted MIDI arrangements to kickstart your productions',
  'Get 100 ready-to-use MIDI arrangements across multiple genres. Perfect for learning song structure, overcoming writer''s block, or quickly building out full tracks. Each arrangement includes complete song structures with intro, verse, chorus, bridge, and outro sections.',
  ARRAY['100 unique MIDI arrangements', 'Multiple genres included', 'Complete song structures', 'Drag and drop into any DAW', 'Learn professional arrangement techniques']
);

-- Link to the download file in LEC bucket
INSERT INTO product_downloads (product_id, download_url, download_path)
SELECT id, 'LEC/100 MIDI Arrangements.zip', 'LEC/100 MIDI Arrangements.zip'
FROM products WHERE title = '100 MIDI Arrangements';