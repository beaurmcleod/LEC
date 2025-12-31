-- Drop and recreate the view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.products_public;

CREATE VIEW public.products_public 
WITH (security_invoker = true)
AS SELECT 
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
FROM products;

-- Add comment documenting the intentional public access
COMMENT ON VIEW public.products_public IS 'Public product catalog view - intentionally exposes product listing data without sensitive download URLs. Uses SECURITY INVOKER to respect RLS on underlying products table.';