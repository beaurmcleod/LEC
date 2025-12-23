-- Drop the incorrectly configured permissive deny policy
DROP POLICY IF EXISTS "Deny anonymous access to download tokens" ON public.download_tokens;

-- Create a RESTRICTIVE policy that requires authentication
-- This will AND with other policies, effectively blocking anonymous access
CREATE POLICY "Require authentication for download tokens"
ON public.download_tokens
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);