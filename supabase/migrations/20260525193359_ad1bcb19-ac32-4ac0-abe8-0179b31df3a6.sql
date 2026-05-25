-- Safety net: auto-sync Meta Ads leads every 15 min (mirrors rd-station-auto-sync)
SELECT cron.unschedule('meta-ads-auto-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-ads-auto-sync');

SELECT cron.schedule(
  'meta-ads-auto-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/meta-sync-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('auto_sync', true)
  ) AS request_id;
  $$
);