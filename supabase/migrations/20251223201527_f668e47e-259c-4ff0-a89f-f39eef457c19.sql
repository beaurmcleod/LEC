-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Service role only" ON public.lesson_reminders;

-- Create explicit denial policies for each operation type
-- These are PERMISSIVE policies that return false, ensuring no access is granted

CREATE POLICY "Deny all SELECT access"
ON public.lesson_reminders
FOR SELECT
TO public
USING (false);

CREATE POLICY "Deny all INSERT access"
ON public.lesson_reminders
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "Deny all UPDATE access"
ON public.lesson_reminders
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all DELETE access"
ON public.lesson_reminders
FOR DELETE
TO public
USING (false);