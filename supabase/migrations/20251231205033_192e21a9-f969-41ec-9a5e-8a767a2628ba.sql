-- Drop existing SELECT policies that may be misconfigured
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.purchases;

-- Create a single permissive SELECT policy with proper access control
CREATE POLICY "Users can view own purchases and admins can view all"
ON public.purchases
FOR SELECT
USING (
  auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)
);