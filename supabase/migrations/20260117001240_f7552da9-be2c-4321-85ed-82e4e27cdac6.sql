-- Fix profiles table: Only allow users to view their own profile
DROP POLICY IF EXISTS "Allow profile viewing" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can only view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Fix download_tokens: Strengthen the policy to prevent cross-user access
DROP POLICY IF EXISTS "Users can view their own tokens only" ON public.download_tokens;

CREATE POLICY "Users can view their own tokens only"
ON public.download_tokens
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (user_id IS NULL AND customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Ensure products_public view has proper RLS (it's a view so we need to check the underlying table)
-- The view should only allow SELECT, which is already controlled by the products table

-- Add explicit deny for coupons to non-admins
DROP POLICY IF EXISTS "Only admins can read coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can view coupons" ON public.coupons;

CREATE POLICY "Only admins can read coupons"
ON public.coupons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Ensure purchases table only shows user's own purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;

CREATE POLICY "Users can view their own purchases"
ON public.purchases
FOR SELECT
USING (
  auth.uid() = user_id 
  OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);