-- Remove the overly permissive policy that allows all authenticated users to manage subscriptions
-- Service role bypasses RLS entirely, so it doesn't need a specific policy
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;

-- The existing "Users can view their own subscriptions" SELECT policy remains
-- INSERT/UPDATE/DELETE operations should only be done via edge functions with service role