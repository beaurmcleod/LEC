-- CITYBOYGHOST: private "all-access" comp code for one artist.
--
-- Grants 100% off EVERY product in the store (applies_to_all = true), with no
-- usage cap and no expiry. The store's existing coupon engine
-- (create-payment-intent -> redeem-coupon) already handles a $0 total: it skips
-- Stripe, records a $0 purchase, mints a download token, and emails the files.
-- Because max_uses is unlimited, the artist can redeem it once per product to
-- unlock the entire catalogue (including products added later).
--
-- Hand this code to the one artist only -- anyone who enters it gets everything
-- free. Levers to lock it down later:
--   Revoke completely : UPDATE public.coupons SET is_active = false   WHERE code = 'CITYBOYGHOST';
--   Cap total redemptions: UPDATE public.coupons SET max_uses = 25    WHERE code = 'CITYBOYGHOST';
--   Set an expiry      : UPDATE public.coupons SET expires_at = now() + interval '30 days' WHERE code = 'CITYBOYGHOST';
--   Limit to some items: UPDATE public.coupons SET applies_to_all = false, product_ids = ARRAY['<uuid>'::uuid] WHERE code = 'CITYBOYGHOST';

INSERT INTO public.coupons (code, discount_type, discount_value, applies_to_all, product_ids, max_uses, expires_at, is_active)
VALUES ('CITYBOYGHOST', 'percentage', 100, true, NULL, NULL, NULL, true)
ON CONFLICT (code) DO UPDATE
SET discount_type  = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    applies_to_all = EXCLUDED.applies_to_all,
    product_ids    = EXCLUDED.product_ids,
    max_uses       = EXCLUDED.max_uses,
    expires_at     = EXCLUDED.expires_at,
    is_active      = EXCLUDED.is_active,
    updated_at     = now();
