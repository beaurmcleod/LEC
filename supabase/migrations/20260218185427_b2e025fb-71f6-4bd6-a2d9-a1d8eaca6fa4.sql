
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_name text NOT NULL,
  rating integer NOT NULL,
  review_text text,
  review_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can read reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);

-- Only service role (Make.com webhook) inserts, no client-side insert needed
