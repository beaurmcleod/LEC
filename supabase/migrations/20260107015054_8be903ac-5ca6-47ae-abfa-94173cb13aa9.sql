-- Fix the 100 MIDI Arrangements path (prefix with LEC/ so code knows to use LEC bucket)
UPDATE public.product_downloads 
SET download_path = 'LEC/100 MIDI Arrangements.zip'
WHERE product_id = '462fd0ed-c75a-4469-bf8c-b03ad23d49b3';

-- Fix The Weeknd Project File path (also in LEC bucket)
UPDATE public.product_downloads 
SET download_path = 'LEC/Big Sleep Project.zip'
WHERE product_id = '9c122b85-5450-424f-b1d9-ab29fe6d7ec9';