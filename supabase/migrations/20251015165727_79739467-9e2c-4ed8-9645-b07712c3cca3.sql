-- Fix search_path mutable vulnerability for handle_updated_at function
-- This sets an explicit search_path to prevent search_path manipulation attacks

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;