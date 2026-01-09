INSERT INTO product_downloads (product_id, download_path, download_url) 
VALUES ('92f0c65c-b44c-4b3a-993a-292b015a13b7', 'LEC/Compressor_Buddy-2.amxd', 'LEC/Compressor_Buddy-2.amxd')
ON CONFLICT (product_id) DO UPDATE SET 
  download_path = EXCLUDED.download_path, 
  download_url = EXCLUDED.download_url;