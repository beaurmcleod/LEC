INSERT INTO product_downloads (product_id, download_path, download_url) 
VALUES ('2ab2c300-7c03-49fc-a551-11062a05ca2b', 'LEC/Deep House Project Files.zip', 'LEC/Deep House Project Files.zip')
ON CONFLICT (product_id) DO UPDATE SET 
  download_path = EXCLUDED.download_path, 
  download_url = EXCLUDED.download_url;