
SELECT cron.schedule(
  'meta-ads-auto-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/meta-sync-leads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
    body := '{"auto_sync": true}'::jsonb
  ) AS request_id;
  $$
);
