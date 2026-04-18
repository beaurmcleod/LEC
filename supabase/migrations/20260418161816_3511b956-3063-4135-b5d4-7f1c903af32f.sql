
-- 1. Recreate creator_earnings view with SECURITY INVOKER so RLS on underlying tables applies
ALTER VIEW public.creator_earnings SET (security_invoker = true);

-- 2. Replace overly-permissive storage policies for content-images / content-videos
DROP POLICY IF EXISTS "Public can view content images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view content videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view content images" ON storage.objects;

CREATE POLICY "Content images access controlled"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'content-images' AND (
    -- creator owns the file (folder = creator user_id)
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.content_media cm
      JOIN public.content_posts cp ON cp.id = cm.post_id
      WHERE cm.media_url LIKE '%' || name
        AND cp.is_published = true
        AND (
          cp.is_free = true
          OR EXISTS (
            SELECT 1 FROM public.creator_subscribers cs
            WHERE cs.fan_id = auth.uid()
              AND cs.creator_id = cp.creator_id
              AND cs.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM public.ppv_unlocks pu
            WHERE pu.user_id = auth.uid() AND pu.post_id = cp.id
          )
        )
    )
  )
);

CREATE POLICY "Content videos access controlled"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'content-videos' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.content_media cm
      JOIN public.content_posts cp ON cp.id = cm.post_id
      WHERE cm.media_url LIKE '%' || name
        AND cp.is_published = true
        AND (
          cp.is_free = true
          OR EXISTS (
            SELECT 1 FROM public.creator_subscribers cs
            WHERE cs.fan_id = auth.uid()
              AND cs.creator_id = cp.creator_id
              AND cs.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM public.ppv_unlocks pu
            WHERE pu.user_id = auth.uid() AND pu.post_id = cp.id
          )
        )
    )
  )
);

-- 3. Tighten upload policies to require path ownership (folder = uploader user_id)
DROP POLICY IF EXISTS "Creators can upload content images" ON storage.objects;
DROP POLICY IF EXISTS "Creators can upload content videos" ON storage.objects;
DROP POLICY IF EXISTS "Creators can upload thumbnails" ON storage.objects;

CREATE POLICY "Creators can upload content images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.creators WHERE user_id = auth.uid())
);

CREATE POLICY "Creators can upload content videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-videos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.creators WHERE user_id = auth.uid())
);

CREATE POLICY "Creators can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.creators WHERE user_id = auth.uid())
);
