-- Remove the insecure public access policy on download_tokens
DROP POLICY IF EXISTS "Anyone can view download tokens" ON public.download_tokens;

-- Add a secure policy that only allows users to view their own tokens by email match
-- (though in practice, edge functions use service role key which bypasses RLS)
CREATE POLICY "Users can view tokens by matching email" 
ON public.download_tokens 
FOR SELECT 
USING (
  customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);