INSERT INTO public.ad_webhook_logs (organization_id, provider, external_lead_id, payload, status, created_at)
SELECT al.organization_id, 'meta', al.external_lead_id,
       jsonb_build_object('id', al.external_lead_id, 'created_time', al.created_time, 'ad_id', al.external_ad_id, 'field_data', COALESCE(al.raw_payload->'field_data','[]'::jsonb), '_source','auto_sync_backfill'),
       'processed', al.created_at
FROM public.ad_leads al
WHERE al.provider = 'meta'
  AND al.external_lead_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_webhook_logs l
    WHERE l.organization_id = al.organization_id
      AND l.external_lead_id = al.external_lead_id
  );