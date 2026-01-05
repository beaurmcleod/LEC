-- Drop the existing permissive policies and create more restrictive ones
-- This adds defense in depth even though the current policies are secure

-- First, drop any overly permissive policies that might exist
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;

-- Keep the specific operation policies which are more secure
-- They already exist: "Users can view their own profile", "Users can update their own profile", "Users can insert their own profile"

-- Add an additional explicit DENY-style check by ensuring NO policy allows cross-user access
-- Create a function to verify profile ownership (defense in depth)
CREATE OR REPLACE FUNCTION public.is_own_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() = profile_id
$$;

-- Recreate policies using the helper function for extra clarity and defense
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (public.is_own_profile(id));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (public.is_own_profile(id))
WITH CHECK (public.is_own_profile(id));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (public.is_own_profile(id));