-- Fix the Key & BPM Finder download to use Supabase Storage instead of Google Drive
UPDATE product_downloads
SET download_url = ''
WHERE product_id = '8fbb3028-e57f-4e44-91ab-44f9229aaf8f'
AND download_path = 'Key & BPM Finder.zip';