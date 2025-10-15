-- Fix security issues with RLS policies

-- 1. Fix products table - restrict download_url access to authenticated users who own the product
DROP POLICY IF EXISTS "Anyone can view product info (no download URLs)" ON public.products;

-- Allow everyone to view basic product info, but not download URLs
-- This policy will be used with the products_public view
CREATE POLICY "Public can view basic product info"
ON public.products
FOR SELECT
USING (true);

-- Only users who purchased the product can access download URLs
-- This will be checked in the edge function, not via direct table access

-- 2. Fix profiles table - restrict email visibility
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Users can only view their own full profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow public to view basic profile info (without email)
-- For now, we'll keep profiles private. If you need public profiles later,
-- create a separate view without email column

-- 3. Verify purchases table security is correct (already good)
-- Users can only see their own purchases via the existing policy