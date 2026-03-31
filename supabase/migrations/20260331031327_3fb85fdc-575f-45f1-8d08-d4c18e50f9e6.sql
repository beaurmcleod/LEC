
-- 1. FIX: profiles table public data exposure - remove blanket public SELECT
DROP POLICY IF EXISTS "Profiles are publicly viewable" ON public.profiles;

-- 2. FIX: stripe_events - Enable RLS
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access stripe_events"
  ON public.stripe_events FOR ALL
  USING (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can view stripe_events"
  ON public.stripe_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. FIX: Tables with RLS enabled but no policies

-- affirmations
CREATE POLICY "Users can view own affirmations"
  ON public.affirmations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own affirmations"
  ON public.affirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own affirmations"
  ON public.affirmations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access affirmations"
  ON public.affirmations FOR ALL
  USING (auth.role() = 'service_role'::text);

-- link_analytics
CREATE POLICY "Service role full access link_analytics"
  ON public.link_analytics FOR ALL
  USING (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can view link_analytics"
  ON public.link_analytics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert link_analytics"
  ON public.link_analytics FOR INSERT
  WITH CHECK (true);

-- subscribers
CREATE POLICY "Users can view own subscriber record"
  ON public.subscribers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access subscribers"
  ON public.subscribers FOR ALL
  USING (auth.role() = 'service_role'::text);

-- 4. FIX: Security definer view (creator_earnings) -> security_invoker
CREATE OR REPLACE VIEW public.creator_earnings
WITH (security_invoker = on) AS
SELECT c.id AS creator_id,
    c.handle,
    COALESCE(sub_earnings.total, 0::bigint) AS subscription_earnings_cents,
    COALESCE(tip_earnings.total, 0::bigint) AS tip_earnings_cents,
    COALESCE(ppv_earnings.total, 0::bigint) AS ppv_earnings_cents,
    COALESCE(sub_earnings.total, 0::bigint) + COALESCE(tip_earnings.total, 0::bigint) + COALESCE(ppv_earnings.total, 0::bigint) AS total_earnings_cents,
    COALESCE(sub_count.total, 0::bigint) AS active_subscribers,
    COALESCE(post_count.total, 0::bigint) AS total_posts
   FROM creators c
     LEFT JOIN ( SELECT cs.creator_id, sum(st.price_cents) AS total FROM creator_subscribers cs JOIN subscription_tiers st ON cs.tier_id = st.id WHERE cs.status = 'active'::text GROUP BY cs.creator_id) sub_earnings ON c.id = sub_earnings.creator_id
     LEFT JOIN ( SELECT tips.to_creator_id AS creator_id, sum(tips.amount_cents) AS total FROM tips WHERE tips.status = 'completed'::text GROUP BY tips.to_creator_id) tip_earnings ON c.id = tip_earnings.creator_id
     LEFT JOIN ( SELECT cp.creator_id, sum(pu.amount_cents) AS total FROM ppv_unlocks pu JOIN content_posts cp ON pu.post_id = cp.id GROUP BY cp.creator_id) ppv_earnings ON c.id = ppv_earnings.creator_id
     LEFT JOIN ( SELECT creator_subscribers.creator_id, count(*) AS total FROM creator_subscribers WHERE creator_subscribers.status = 'active'::text GROUP BY creator_subscribers.creator_id) sub_count ON c.id = sub_count.creator_id
     LEFT JOIN ( SELECT content_posts.creator_id, count(*) AS total FROM content_posts WHERE content_posts.is_published = true GROUP BY content_posts.creator_id) post_count ON c.id = post_count.creator_id;

-- 5. FIX: Functions with mutable search_path

CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS text LANGUAGE plpgsql SET search_path = public
AS $function$
DECLARE key TEXT; chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i INT; segment TEXT;
BEGIN
  key := 'CRUX-';
  FOR s IN 1..4 LOOP
    segment := '';
    FOR i IN 1..4 LOOP
      segment := segment || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF s < 4 THEN key := key || segment || '-'; ELSE key := key || segment; END IF;
  END LOOP;
  RETURN key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, display_name, site)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name', COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), COALESCE(NEW.raw_user_meta_data->>'site', 'lowendcandy'));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_subscription_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE new_key TEXT; existing_license UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    SELECT id INTO existing_license FROM public.licenses WHERE user_id = NEW.user_id AND product = 'crux_chords';
    IF existing_license IS NULL THEN
      LOOP
        new_key := public.generate_license_key();
        BEGIN
          INSERT INTO public.licenses (user_id, license_key, product, status, subscription_id) VALUES (NEW.user_id, new_key, 'crux_chords', 'active', NEW.id);
          EXIT;
        EXCEPTION WHEN unique_violation THEN END;
      END LOOP;
    ELSE
      UPDATE public.licenses SET status = 'active', subscription_id = NEW.id WHERE id = existing_license;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
      SELECT id INTO existing_license FROM public.licenses WHERE user_id = NEW.user_id AND product = 'crux_chords';
      IF existing_license IS NULL THEN
        LOOP
          new_key := public.generate_license_key();
          BEGIN
            INSERT INTO public.licenses (user_id, license_key, product, status, subscription_id) VALUES (NEW.user_id, new_key, 'crux_chords', 'active', NEW.id);
            EXIT;
          EXCEPTION WHEN unique_violation THEN END;
        END LOOP;
      ELSE
        UPDATE public.licenses SET status = 'active', subscription_id = NEW.id WHERE id = existing_license;
      END IF;
    ELSIF NEW.status IN ('canceled', 'cancelled', 'expired', 'past_due', 'unpaid') THEN
      UPDATE public.licenses SET status = 'revoked' WHERE subscription_id = NEW.id OR (user_id = NEW.user_id AND product = 'crux_chords');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_daily_counts()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $function$
  UPDATE public.licenses SET requests_today = 0, last_reset_date = CURRENT_DATE WHERE last_reset_date < CURRENT_DATE;
$function$;

CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.content_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.content_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.content_posts SET like_count = like_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.content_posts SET like_count = like_count - 1 WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- 6. FIX: Overly permissive INSERT policy on link_clicks
DROP POLICY IF EXISTS "Anyone authenticated can insert link clicks" ON public.link_clicks;
