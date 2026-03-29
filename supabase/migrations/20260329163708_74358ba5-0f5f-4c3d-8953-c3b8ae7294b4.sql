
-- Fix 1: Replace permissive content_media SELECT policy with proper access check
DROP POLICY IF EXISTS "Media visible with post access" ON public.content_media;

CREATE POLICY "Media visible with post access" ON public.content_media
FOR SELECT
USING (
  post_id IN (
    SELECT cp.id FROM public.content_posts cp
    WHERE cp.is_published = true
    AND (
      cp.is_free = true
      OR cp.creator_id IN (
        SELECT c.id FROM public.creators c WHERE c.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.creator_subscribers cs
        WHERE cs.fan_id = auth.uid()
        AND cs.creator_id = cp.creator_id
        AND cs.status = 'active'
      )
    )
  )
);

-- Fix 2: Enable RLS on license_dashboard and add admin-only policy
ALTER TABLE public.license_dashboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access license dashboard"
ON public.license_dashboard
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
