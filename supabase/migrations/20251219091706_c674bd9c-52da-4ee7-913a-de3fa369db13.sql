INSERT INTO download_tokens (token, customer_email, product_id, expires_at, max_downloads)
VALUES (
  'real_test_token_beaurmcleod_keybpm_2025',
  'beaurmcleod@gmail.com',
  '8fbb3028-e57f-4e44-91ab-44f9229aaf8f',
  NOW() + INTERVAL '7 days',
  5
);