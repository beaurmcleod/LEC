-- Drop the existing policy if it exists (it may be permissive)
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- Create a restrictive policy that explicitly denies anonymous access
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
AS RESTRICTIVE
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);