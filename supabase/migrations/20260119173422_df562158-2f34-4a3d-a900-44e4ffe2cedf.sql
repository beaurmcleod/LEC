-- COMPREHENSIVE FIX: Clean up ALL existing policies and create strict new ones
-- This ensures no legacy permissive policies remain

-- 1. LESSON_REMINDERS: Add explicit DENY SELECT to complement existing denies
DROP POLICY IF EXISTS "Deny all SELECT access" ON public.lesson_reminders;
CREATE POLICY "Deny all SELECT access"
ON public.lesson_reminders
FOR SELECT
USING (false);

-- 2. PRODUCTS_PUBLIC view: Ensure proper RLS handling
-- This is a view based on products table, so we can't add RLS directly
-- The products table has proper public SELECT which is intentional for a store

-- 3. SUBSCRIPTIONS: Add explicit auth check
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Authenticated users can view own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. PURCHASES: Strengthen the policy
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Authenticated users can view own purchases"
ON public.purchases
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id 
    OR customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- 5. PROFILES: Clean up any conflicting policies and ensure strict access
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.profiles;
CREATE POLICY "Only authenticated users view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- 6. DOWNLOAD_TOKENS: Clean up
DROP POLICY IF EXISTS "Users can view their own download tokens" ON public.download_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens only" ON public.download_tokens;
CREATE POLICY "Authenticated users view own download tokens"
ON public.download_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 7. GOOGLE_CALENDAR_TOKENS: Ensure admin-only access
DROP POLICY IF EXISTS "Admins can view calendar tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can view own Google Calendar tokens" ON public.google_calendar_tokens;
-- Already has correct admin-only policy via "Admins can manage their own tokens"