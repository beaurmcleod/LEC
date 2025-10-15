-- Fix overly permissive RLS policies on purchases table
-- This prevents unauthorized access to customer emails, payment IDs, and purchase data

-- Drop the overly permissive policy that allows anyone to view all purchases
DROP POLICY IF EXISTS "Anyone can view purchases by email" ON public.purchases;

-- Drop the existing policy with the OR condition that exposes all purchases with emails
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;

-- Create a secure policy that only allows users to view their own purchases
CREATE POLICY "Users can view their own purchases" 
ON public.purchases 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Note: Guest purchases (users who bought without an account) are handled 
-- securely through the get-secure-download edge function which verifies 
-- email ownership before providing download URLs