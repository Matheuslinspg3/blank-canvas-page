
-- Function to get cron job status by name
CREATE OR REPLACE FUNCTION public.get_cron_job_status(p_job_name text)
RETURNS TABLE(jobid bigint, schedule text, active boolean, jobname text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, cron, public
AS $$
  SELECT jobid, schedule, active, jobname
  FROM cron.job
  WHERE jobname = p_job_name
  LIMIT 1;
$$;

-- Function to manage cron jobs (upsert or disable)
CREATE OR REPLACE FUNCTION public.manage_cron_job(
  p_action text,
  p_job_name text,
  p_schedule text DEFAULT NULL,
  p_command text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, cron, public
AS $$
BEGIN
  IF p_action = 'disable' THEN
    -- Unschedule the job
    PERFORM cron.unschedule(p_job_name);
  ELSIF p_action = 'upsert' THEN
    -- Remove existing then re-create with new schedule
    BEGIN
      PERFORM cron.unschedule(p_job_name);
    EXCEPTION WHEN OTHERS THEN
      -- Job may not exist yet, that's fine
      NULL;
    END;
    PERFORM cron.schedule(p_job_name, p_schedule, p_command);
  END IF;
END;
$$;
