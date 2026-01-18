-- Fix 1: profiles table - Add explicit denial for unauthenticated access
-- First, ensure only authenticated users can access profiles at all
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;

-- Create a single clear policy for authenticated users viewing their own profile
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = id
);

-- Fix 2: download_tokens - Remove the email-based fallback that could expose data
-- The issue is allowing access when user_id IS NULL based on email matching
-- Instead, require user_id to always be set OR be admin
DROP POLICY IF EXISTS "Users can view their own tokens only" ON public.download_tokens;

-- Stricter policy: Must have user_id match, no email-based fallback for SELECT
CREATE POLICY "Users can view their own tokens only"
ON public.download_tokens
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
);

-- Note: Admins already have a separate policy to view all tokens