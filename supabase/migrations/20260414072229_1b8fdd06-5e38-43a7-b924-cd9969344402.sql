DROP POLICY IF EXISTS "Authenticated users can view own purchases" ON public.purchases;
CREATE POLICY "Authenticated users can view own purchases"
ON public.purchases
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
  AND (
    auth.uid() = user_id
    OR lower(customer_email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text)
  )
);

DROP POLICY IF EXISTS "Authenticated users view own download tokens" ON public.download_tokens;
CREATE POLICY "Authenticated users view own download tokens"
ON public.download_tokens
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL
  AND (
    auth.uid() = user_id
    OR lower(customer_email) = lower((SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text)
  )
);