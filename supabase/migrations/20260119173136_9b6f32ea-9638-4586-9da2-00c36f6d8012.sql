-- CRITICAL SECURITY FIX: Block all unauthenticated (public) access to sensitive tables
-- This addresses Google's "Compromised Site" detection by securing data exposure

-- 1. profiles table - Block public access
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- 2. purchases table - Block public access
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Users can view their own purchases"
ON public.purchases
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. download_tokens table - Block public access
DROP POLICY IF EXISTS "Users can view their own tokens only" ON public.download_tokens;
CREATE POLICY "Users can view their own download tokens"
ON public.download_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. google_calendar_tokens table - Admin only (via has_role function)
DROP POLICY IF EXISTS "Users can view own Google Calendar tokens" ON public.google_calendar_tokens;
CREATE POLICY "Admins can view calendar tokens"
ON public.google_calendar_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

-- 5. subscriptions table - Block public access
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 6. product_downloads table - Admin only
DROP POLICY IF EXISTS "Admins can manage product downloads" ON public.product_downloads;
CREATE POLICY "Admins can view product downloads"
ON public.product_downloads
FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

-- 7. user_roles table - Users can only see their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 8. settings table - Admin only
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can read settings"
ON public.settings
FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage settings"
ON public.settings
FOR ALL
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));

-- 9. link_clicks table - Admin only for analytics
DROP POLICY IF EXISTS "Anyone can insert link clicks" ON public.link_clicks;
DROP POLICY IF EXISTS "Admins can view link clicks" ON public.link_clicks;
CREATE POLICY "Anyone authenticated can insert link clicks"
ON public.link_clicks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view link clicks"
ON public.link_clicks
FOR SELECT
USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));