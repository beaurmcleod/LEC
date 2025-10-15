-- Create a private storage bucket for purchased products
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-downloads',
  'product-downloads',
  false,
  52428800, -- 50MB limit
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read files they've purchased
CREATE POLICY "Users can download purchased products"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-downloads' 
  AND EXISTS (
    SELECT 1 
    FROM purchases 
    WHERE purchases.user_id = auth.uid() 
    AND purchases.product_id::text = (storage.foldername(name))[1]
  )
);

-- Allow service role to manage all files in the bucket
CREATE POLICY "Service role can manage product downloads"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'product-downloads')
WITH CHECK (bucket_id = 'product-downloads');