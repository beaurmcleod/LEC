-- Add constraints to prevent large payload attacks
ALTER TABLE public.link_clicks 
  ADD CONSTRAINT link_clicks_url_length CHECK (char_length(link_url) <= 500),
  ADD CONSTRAINT link_clicks_title_length CHECK (char_length(link_title) <= 200);

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_link_click_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count clicks in the last minute for same URL (prevents flooding same link)
  SELECT COUNT(*) INTO recent_count
  FROM public.link_clicks
  WHERE link_url = NEW.link_url
    AND clicked_at > NOW() - INTERVAL '1 minute';
  
  -- Allow max 10 clicks per URL per minute
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded for this link';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for rate limiting
CREATE TRIGGER enforce_link_click_rate_limit
  BEFORE INSERT ON public.link_clicks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_link_click_rate_limit();