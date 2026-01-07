-- Fix purchases table RLS policies
DROP POLICY IF EXISTS "Deny anonymous access to purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can view own purchases and admins can view all" ON public.purchases;
DROP POLICY IF EXISTS "Service role can insert purchases" ON public.purchases;

-- Users can only view their own purchases (requires auth)
CREATE POLICY "Users can view own purchases"
ON public.purchases
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.purchases
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts are handled by edge functions using service role key
-- This policy allows inserts only from authenticated contexts (service role bypasses RLS anyway)
CREATE POLICY "Authenticated can insert purchases"
ON public.purchases
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL OR current_setting('role') = 'service_role');