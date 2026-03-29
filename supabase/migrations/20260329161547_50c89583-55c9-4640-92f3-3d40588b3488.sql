-- Fix: Add 'content_platform' to allowed sites AND update default to 'lowendcandy'
ALTER TABLE public.profiles DROP CONSTRAINT profiles_site_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_site_check 
  CHECK (site = ANY (ARRAY['promptmidi', '30dayedmproducer', 'producer-operating-system', 'lowendcandy', 'tts', 'content_platform']));

-- Update handle_new_user to set site = 'lowendcandy' for this app
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, display_name, site)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'site', 'lowendcandy')
  );
  RETURN NEW;
END;
$function$;

-- Also update default column value
ALTER TABLE public.profiles ALTER COLUMN site SET DEFAULT 'lowendcandy';