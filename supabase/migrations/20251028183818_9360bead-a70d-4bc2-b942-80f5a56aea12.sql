-- Make LEC bucket private to prevent unauthorized access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'LEC';

-- Add RLS policies for LEC bucket (admin only access)
CREATE POLICY "Admins can upload to LEC bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'LEC' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update files in LEC bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'LEC' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete from LEC bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'LEC' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view LEC bucket files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'LEC' AND has_role(auth.uid(), 'admin'::app_role));