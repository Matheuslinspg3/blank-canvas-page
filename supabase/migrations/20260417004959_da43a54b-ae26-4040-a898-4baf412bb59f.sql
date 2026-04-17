
-- Remove existing job with same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('voice-call-queue-worker-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'voice-call-queue-worker-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/voice-call-queue-worker',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYWp1eHhzeHJ3dXFyZWdkemptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Nzc3MzksImV4cCI6MjA4OTM1MzczOX0.DnXKqDy0PFYTfuUerolmBy-t_fbrM8Xt4uDtifoDxV0"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
