-- Drop existing SELECT policies on download_tokens
DROP POLICY IF EXISTS "Users can view tokens by matching email" ON public.download_tokens;
DROP POLICY IF EXISTS "Deny anonymous access to download tokens" ON public.download_tokens;

-- Create a single, properly restrictive SELECT policy
-- Users can only view tokens where the customer_email matches their authenticated email
CREATE POLICY "Users can only view their own tokens"
ON public.download_tokens
FOR SELECT
TO authenticated
USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);