
-- 1. Creators table: hide financial fields from public
REVOKE ALL ON public.creators FROM anon, authenticated;
GRANT SELECT (id, user_id, handle, display_name, bio, avatar_url, banner_url, verification_status, is_active, created_at, updated_at)
  ON public.creators TO anon, authenticated;
GRANT INSERT, UPDATE ON public.creators TO authenticated;
-- payout_info, commission_rate, payout_method-ish fields are only visible to service_role and via SECURITY DEFINER functions
-- Also explicitly grant the financial columns to service_role (already implied but explicit)
GRANT SELECT (payout_info, commission_rate) ON public.creators TO service_role;

-- Allow creators to see their own financial fields via a separate policy + a narrow SELECT grant for owner via security definer is too complex
-- Instead, restrict at policy level for whole row and use column grants above (RLS still applies)
-- Add policy so creators see all their own row including financial cols (column grants restrict for others)
DROP POLICY IF EXISTS "Creators can view own financial info" ON public.creators;
CREATE POLICY "Creators can view own financial info"
  ON public.creators FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins too
DROP POLICY IF EXISTS "Admins can view all creators" ON public.creators;
CREATE POLICY "Admins can view all creators"
  ON public.creators FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Re-grant financial cols to authenticated; RLS narrows it down to owner (per Creators can view own financial info policy)
GRANT SELECT (payout_info, commission_rate) ON public.creators TO authenticated;

-- 2. dm-media bucket: scope to message participants
DROP POLICY IF EXISTS "Users can view DM media they sent or received" ON storage.objects;
CREATE POLICY "Users can view DM media they sent or received"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dm-media'
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.media_url LIKE '%' || storage.objects.name
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    )
  );

-- 3. ai-generated bucket: scope to requester
DROP POLICY IF EXISTS "Authenticated users can view AI content" ON storage.objects;
CREATE POLICY "Users can view own AI generated content"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ai-generated'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.ai_content ac
        WHERE ac.media_url LIKE '%' || storage.objects.name
          AND ac.requested_by = auth.uid()
      )
    )
  );

-- 4. content-images: add creator-owner access branch
DROP POLICY IF EXISTS "Content images access controlled" ON storage.objects;
CREATE POLICY "Content images access controlled"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'content-images'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1
        FROM content_media cm
        JOIN content_posts cp ON cp.id = cm.post_id
        JOIN creators c ON c.id = cp.creator_id
        WHERE cm.media_url LIKE '%' || storage.objects.name
          AND cp.is_published = true
          AND (
            cp.is_free = true
            OR c.user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM creator_subscribers cs WHERE cs.fan_id = auth.uid() AND cs.creator_id = cp.creator_id AND cs.status = 'active')
            OR EXISTS (SELECT 1 FROM ppv_unlocks pu WHERE pu.user_id = auth.uid() AND pu.post_id = cp.id)
          )
      )
    )
  );

-- 5. pos_daily_rollup: admin only
DROP POLICY IF EXISTS pos_daily_rollup_authenticated_read ON public.pos_daily_rollup;
CREATE POLICY pos_daily_rollup_admin_read
  ON public.pos_daily_rollup FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. system_health: admin only
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='system_health' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_health', p.policyname);
  END LOOP;
END $$;
CREATE POLICY system_health_admin_read
  ON public.system_health FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
