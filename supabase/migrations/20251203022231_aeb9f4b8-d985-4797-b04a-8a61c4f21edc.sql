-- Add policy to allow users to look up their download tokens by email
CREATE POLICY "Users can view download tokens by email"
ON public.download_tokens
FOR SELECT
USING (true);