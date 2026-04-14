
DROP POLICY IF EXISTS "Authenticated users view own download tokens" ON public.download_tokens;

CREATE POLICY "Authenticated users view own download tokens"
ON public.download_tokens
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
  AND (
    auth.uid() = user_id
    OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  )
);
