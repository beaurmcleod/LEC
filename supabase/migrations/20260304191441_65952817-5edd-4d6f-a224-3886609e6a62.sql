SELECT cron.schedule(
  'daily-health-check-8am-pst',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url:='https://ocydkbblpnshbvkilngl.supabase.co/functions/v1/daily-health-check',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jeWRrYmJscG5zaGJ2a2lsbmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTMxODEsImV4cCI6MjA2NzQ4OTE4MX0.49qXNYjKsqDDj7qKSNcc2_nWnI9oLWVJgzKanrxI1So"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);