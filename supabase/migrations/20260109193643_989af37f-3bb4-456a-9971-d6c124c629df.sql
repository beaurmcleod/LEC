-- Configure all product downloads
INSERT INTO product_downloads (product_id, download_path, download_url) VALUES
  ('94e86222-41df-461d-83c6-ef22f08e58ff', 'LEC/1 KNOB BUILD.adg', 'LEC/1 KNOB BUILD.adg'),
  ('8fc3fec6-fd1e-469a-a15d-5c4d03dc6cb1', 'LEC/27 OTT RACK.adg', 'LEC/27 OTT RACK.adg'),
  ('942d44ce-056f-410e-ad33-dab983c4538c', 'LEC/Ableton Quick Commands.pdf', 'LEC/Ableton Quick Commands.pdf'),
  ('655ecd77-3430-4bc6-b6a8-bf7c45d6c569', 'LEC/Bohemyth Sample Pack.zip', 'LEC/Bohemyth Sample Pack.zip'),
  ('01b73798-cd27-42c9-86bc-bf14994602cd', 'LEC/Bohemyth Serum Rack.adg', 'LEC/Bohemyth Serum Rack.adg'),
  ('0cf95d2b-b1e2-4ae8-8e61-e8f29fe15c83', 'LEC/Hubert Haas Effect.adg', 'LEC/Hubert Haas Effect.adg'),
  ('b16244c6-3126-449a-8464-da8bd0d4b822', 'LEC/HAT SAUCE.adg', 'LEC/HAT SAUCE.adg'),
  ('497c2f2b-d33d-4a48-a883-def4e8f20253', 'LEC/Hip Hop & Trap Starter Kit.zip', 'LEC/Hip Hop & Trap Starter Kit.zip'),
  ('0706739f-1577-44df-8757-a46e20989d13', 'LEC/Serum 2 Randomize Rack.adg', 'LEC/Serum 2 Randomize Rack.adg'),
  ('7805a292-e249-4735-9197-b7d16301f929', 'LEC/Vocal Clean Up Rack.adg', 'LEC/Vocal Clean Up Rack.adg'),
  ('8231db63-1d82-4e28-b3cf-da31874d716a', 'LEC/Vocal Sauce.adg', 'LEC/Vocal Sauce.adg')
ON CONFLICT (product_id) DO UPDATE SET 
  download_path = EXCLUDED.download_path, 
  download_url = EXCLUDED.download_url;

-- Fix Key & BPM Finder to have LEC/ prefix
UPDATE product_downloads 
SET download_path = 'LEC/Key & BPM Finder 2.0.zip', 
    download_url = 'LEC/Key & BPM Finder 2.0.zip'
WHERE product_id = '8fbb3028-e57f-4e44-91ab-44f9229aaf8f';