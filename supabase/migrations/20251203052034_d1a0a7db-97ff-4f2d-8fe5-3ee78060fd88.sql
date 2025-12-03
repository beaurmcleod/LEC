-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view download tokens by email" ON public.download_tokens;

-- Create a permissive policy that allows anyone to view download tokens
-- This is needed for unauthenticated users to access their download after purchase
CREATE POLICY "Anyone can view download tokens"
ON public.download_tokens
FOR SELECT
USING (true);