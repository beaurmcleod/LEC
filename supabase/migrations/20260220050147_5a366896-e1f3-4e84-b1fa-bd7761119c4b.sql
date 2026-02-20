
-- Create tracks table for the catalogue
CREATE TABLE public.tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Bohemyth',
  artwork_url TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  genre TEXT,
  release_year INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can view tracks
CREATE POLICY "Public can view tracks" ON public.tracks
  FOR SELECT USING (true);

-- Only admins can manage tracks
CREATE POLICY "Admins can manage tracks" ON public.tracks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create a public storage bucket for track audio
INSERT INTO storage.buckets (id, name, public) VALUES ('tracks', 'tracks', true);

-- Storage policies for track files
CREATE POLICY "Public can read track files" ON storage.objects
  FOR SELECT USING (bucket_id = 'tracks');

CREATE POLICY "Admins can upload track files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update track files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete track files" ON storage.objects
  FOR DELETE USING (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));
