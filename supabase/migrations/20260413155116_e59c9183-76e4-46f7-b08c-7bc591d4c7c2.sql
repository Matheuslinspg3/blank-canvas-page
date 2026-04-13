
-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule monthly automation credit injection (1st of each month at 03:00 UTC)
SELECT cron.schedule(
  'automation-monthly-credits',
  '0 3 1 * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/automation-monthly-credits',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
