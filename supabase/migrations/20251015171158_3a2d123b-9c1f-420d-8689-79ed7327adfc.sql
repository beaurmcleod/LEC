-- Fix security definer view warning
-- Change products_public view to use SECURITY INVOKER to respect RLS policies

DROP VIEW IF EXISTS public.products_public;

CREATE VIEW public.products_public 
WITH (security_invoker=on) AS
SELECT 
  id,
  title,
  price,
  original_price,
  image,
  category,
  bpm,
  key,
  short_description,
  full_description,
  features,
  is_on_sale,
  created_at,
  updated_at
FROM public.products;