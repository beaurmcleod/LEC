-- Drop the existing permissive SELECT policy that may be too broad
DROP POLICY IF EXISTS "Users can view their own tokens securely" ON public.download_tokens;

-- Recreate with more explicit ownership check
-- Users can only see tokens where:
-- 1. The token's user_id matches their auth.uid(), OR
-- 2. The token's customer_email matches their email address
CREATE POLICY "Users can view their own tokens only"
ON public.download_tokens
FOR SELECT
USING (
  user_id = auth.uid()
  OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);