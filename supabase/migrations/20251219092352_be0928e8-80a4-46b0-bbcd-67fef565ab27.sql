-- Drop the overly permissive policy (service role bypasses RLS automatically)
DROP POLICY IF EXISTS "Service role can manage download tokens" ON public.download_tokens;

-- Add explicit deny for anonymous users
CREATE POLICY "Deny anonymous access to download tokens" 
ON public.download_tokens 
FOR ALL 
TO anon 
USING (false)
WITH CHECK (false);