-- Update Key & BPM Finder to show "Beginning of Year" sale
UPDATE public.products 
SET is_on_sale = true, 
    original_price = '14.99',
    price = '9.99'
WHERE id = '8fbb3028-e57f-4e44-91ab-44f9229aaf8f';