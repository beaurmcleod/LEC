-- Remove the duplicate/old cron jobs
SELECT cron.unschedule('daily-checkout-health-check');
SELECT cron.unschedule('daily-health-check-8am-pst');

-- Create a single 24h job at 8:00 AM PST (16:00 UTC)
SELECT cron.schedule(
  'daily-health-check-24h',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ocydkbblpnshbvkilngl.supabase.co/functions/v1/daily-health-check',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jeWRrYmJscG5zaGJ2a2lsbmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTMxODEsImV4cCI6MjA2NzQ4OTE4MX0.49qXNYjKsqDDj7qKSNcc2_nWnI9oLWVJgzKanrxI1So"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);