-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;

-- Create a more restrictive SELECT policy that requires user_id to NOT be null
CREATE POLICY "Users can view their own purchases"
ON public.purchases
FOR SELECT
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- Add admin access policy so admins can still manage purchases
CREATE POLICY "Admins can view all purchases"
ON public.purchases
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));