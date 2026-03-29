
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active pos_products"
ON public.pos_products FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage pos_products"
ON public.pos_products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
