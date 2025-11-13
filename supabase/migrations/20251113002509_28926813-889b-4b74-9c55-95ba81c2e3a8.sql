-- Create table for tracking link clicks
CREATE TABLE public.link_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_url text NOT NULL,
  link_title text NOT NULL,
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert clicks (tracking)
CREATE POLICY "Anyone can insert link clicks"
ON public.link_clicks
FOR INSERT
WITH CHECK (true);

-- Only admins can view click data
CREATE POLICY "Admins can view all link clicks"
ON public.link_clicks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better query performance
CREATE INDEX idx_link_clicks_url ON public.link_clicks(link_url);
CREATE INDEX idx_link_clicks_clicked_at ON public.link_clicks(clicked_at DESC);