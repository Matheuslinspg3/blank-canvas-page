UPDATE leads l
SET 
  conversion_identifier = COALESCE(
    wl.payload->'last_conversion'->'content'->>'identificador',
    wl.payload->'first_conversion'->'content'->>'identificador',
    wl.payload->'first_conversion'->'content'->>'conversion_identifier'
  ),
  traffic_source = COALESCE(
    wl.payload->'last_conversion'->>'source',
    wl.payload->'first_conversion'->>'source'
  )
FROM rd_station_webhook_logs wl
WHERE wl.payload->>'uuid' = l.external_id
  AND l.external_source = 'rdstation'
  AND l.is_active = true
  AND l.conversion_identifier IS NULL
  AND wl.event_type = 'conversion';