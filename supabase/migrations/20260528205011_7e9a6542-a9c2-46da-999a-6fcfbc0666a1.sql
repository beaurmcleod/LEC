ALTER TABLE public.link_clicks ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_link_clicks_source ON public.link_clicks(source);