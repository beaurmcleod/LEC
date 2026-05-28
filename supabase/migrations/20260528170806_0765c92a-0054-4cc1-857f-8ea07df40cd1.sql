
-- Fix 1: Lock down realtime.messages so users can only subscribe to channels they own
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users own channel only" ON realtime.messages;
CREATE POLICY "Authenticated users own channel only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'user:' || auth.uid()::text || ':%')
  OR (realtime.topic() LIKE 'user:' || auth.uid()::text)
);

-- Fix 2: Restrict pos_link_clicks to admins only
DROP POLICY IF EXISTS "authenticated read pos_link_clicks" ON public.pos_link_clicks;
CREATE POLICY "Admins can read pos_link_clicks"
ON public.pos_link_clicks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
