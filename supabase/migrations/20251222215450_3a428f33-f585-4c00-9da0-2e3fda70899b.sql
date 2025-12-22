-- Add restrictive policy to deny anonymous access to purchases
CREATE POLICY "Deny anonymous access to purchases"
ON public.purchases
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);