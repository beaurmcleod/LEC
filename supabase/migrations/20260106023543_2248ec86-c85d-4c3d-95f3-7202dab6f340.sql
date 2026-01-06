-- Drop the existing SELECT policy that exposes emails
DROP POLICY IF EXISTS "Users can view their own tokens only" ON public.download_tokens;

-- Create a stricter SELECT policy that only allows user_id matching
CREATE POLICY "Users can view their own tokens only"
ON public.download_tokens
FOR SELECT
USING (user_id = auth.uid());