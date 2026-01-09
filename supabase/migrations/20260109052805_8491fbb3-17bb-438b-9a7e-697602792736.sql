-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limit_log;

-- Create a proper restrictive policy that only allows service role operations
-- Note: Service role bypasses RLS anyway, so we need to deny all client access
CREATE POLICY "Deny all public access to rate_limit_log"
ON public.rate_limit_log
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);