
-- Schedule daily cleanup at 3 AM UTC
SELECT cron.schedule(
  'cleanup-old-logs',
  '0 3 * * *',
  $$SELECT public.cleanup_old_logs()$$
);
