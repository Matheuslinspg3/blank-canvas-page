-- Populate ad_webhook_logs from existing ad_leads
INSERT INTO public.ad_webhook_logs (organization_id, provider, external_lead_id, payload, status, created_at)
SELECT 
    organization_id, 
    provider::text, 
    external_lead_id, 
    COALESCE(raw_payload, jsonb_build_object('info', 'Lead importado historicamente', 'name', name, 'email', email)),
    'processed',
    created_time
FROM public.ad_leads
ON CONFLICT DO NOTHING;