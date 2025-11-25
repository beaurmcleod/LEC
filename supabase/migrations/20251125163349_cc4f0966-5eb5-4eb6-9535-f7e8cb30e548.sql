-- Update product_downloads to use the uploaded file instead of Google Drive link
UPDATE product_downloads 
SET download_path = 'key-bpm-finder.zip'
WHERE product_id = '8fbb3028-e57f-4e44-91ab-44f9229aaf8f';