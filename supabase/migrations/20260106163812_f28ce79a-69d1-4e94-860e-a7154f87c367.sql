-- Fix Issue 1: link_clicks unauthenticated insert
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Anyone can insert link clicks" ON public.link_clicks;

-- Create a new policy requiring authentication
CREATE POLICY "Authenticated users can insert link clicks"
ON public.link_clicks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix Issue 3: Admin setup race condition
-- Create a function to prevent unauthorized first admin creation
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_first_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Count existing admins
  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin';
  
  -- If no admin exists, this is the first admin claim
  -- Allow it only if the user is authenticated
  IF admin_count = 0 THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'First admin must be claimed by an authenticated user';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for first admin protection
DROP TRIGGER IF EXISTS check_first_admin ON public.user_roles;
CREATE TRIGGER check_first_admin
BEFORE INSERT ON public.user_roles
FOR EACH ROW
WHEN (NEW.role = 'admin')
EXECUTE FUNCTION public.prevent_unauthorized_first_admin();