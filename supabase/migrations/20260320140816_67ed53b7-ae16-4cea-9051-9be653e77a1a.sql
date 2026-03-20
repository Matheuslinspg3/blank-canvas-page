
-- DISK IO OPTIMIZATION: Clean old data + drop unused indexes

-- 1. Clean rd_station_webhook_logs older than 7 days
DELETE FROM public.rd_station_webhook_logs 
WHERE created_at < now() - interval '7 days';

-- 2. Drop unused indexes (0 scans = wasting IO on every write)
DROP INDEX IF EXISTS public.idx_activity_log_user;
DROP INDEX IF EXISTS public.idx_property_images_cache_status;
DROP INDEX IF EXISTS public.idx_audit_entity;
DROP INDEX IF EXISTS public.idx_properties_title_trgm;
DROP INDEX IF EXISTS public.idx_properties_neighborhood_trgm;
DROP INDEX IF EXISTS public.idx_audit_user_created;
DROP INDEX IF EXISTS public.idx_audit_action;
DROP INDEX IF EXISTS public.idx_audit_module;
DROP INDEX IF EXISTS public.idx_properties_city_trgm;
DROP INDEX IF EXISTS public.idx_properties_code_prefix;
DROP INDEX IF EXISTS public.idx_properties_latlng;
DROP INDEX IF EXISTS public.idx_properties_lat_lng;
DROP INDEX IF EXISTS public.idx_leads_interested_property_type_id;
DROP INDEX IF EXISTS public.idx_property_owners_owner_id;

-- 3. Add index on webhook logs to prevent seq scans
CREATE INDEX IF NOT EXISTS idx_rd_webhook_logs_created 
ON public.rd_station_webhook_logs(created_at DESC);

-- 4. Create cleanup function for scheduled maintenance
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rd_station_webhook_logs 
  WHERE created_at < now() - interval '7 days';
  
  DELETE FROM public.activity_log
  WHERE created_at < now() - interval '90 days';
  
  DELETE FROM public.notifications
  WHERE created_at < now() - interval '30 days'
  AND read = true;
$$;
