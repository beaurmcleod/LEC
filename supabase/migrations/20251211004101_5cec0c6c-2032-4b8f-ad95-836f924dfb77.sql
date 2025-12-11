-- Add explicit denial for anonymous users on download_tokens
CREATE POLICY "Deny anonymous access to download tokens" 
ON public.download_tokens 
FOR SELECT 
USING (auth.uid() IS NOT NULL);