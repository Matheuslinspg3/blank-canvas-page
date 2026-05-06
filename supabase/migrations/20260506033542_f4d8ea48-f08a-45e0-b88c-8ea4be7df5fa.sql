-- Update existing logs that were created without phone/ad_id
UPDATE public.ad_webhook_logs l
SET payload = jsonb_build_object(
    'info', 'Lead importado historicamente',
    'name', al.name,
    'email', al.email,
    'phone', al.phone,
    'ad_id', al.external_ad_id
)
FROM public.ad_leads al
WHERE l.external_lead_id = al.external_lead_id 
AND l.payload->>'info' = 'Lead importado historicamente';

-- Ensure future imports (if any) include all fields
-- (This is just for completeness if the previous migration is re-run)
INSERT INTO public.ad_webhook_logs (
    organization_id, 
    provider, 
    external_lead_id, 
    payload, 
    status, 
    created_at
)
SELECT 
    organization_id, 
    'meta', 
    external_lead_id, 
    jsonb_build_object(
        'info', 'Lead importado historicamente', 
        'name', name, 
        'email', email, 
        'phone', phone, 
        'ad_id', external_ad_id
    ),
    'processed',
    created_time
FROM public.ad_leads
ON CONFLICT DO NOTHING;