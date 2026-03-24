CREATE OR REPLACE FUNCTION public.register_session(
  p_session_token text,
  p_device_type text DEFAULT 'desktop'::text,
  p_device_info text DEFAULT NULL::text,
  p_ip_address text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_session_count int;
  v_evicted_count int := 0;
  v_max_sessions int := 2;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  INSERT INTO public.user_sessions (user_id, session_token, device_type, device_info, ip_address, last_seen_at)
  VALUES (v_user_id, p_session_token, p_device_type, p_device_info, p_ip_address, now())
  ON CONFLICT (session_token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    last_seen_at = now(),
    device_type = EXCLUDED.device_type,
    device_info = EXCLUDED.device_info,
    ip_address = EXCLUDED.ip_address;

  SELECT count(*) INTO v_session_count
  FROM public.user_sessions
  WHERE user_id = v_user_id;

  IF v_session_count > v_max_sessions THEN
    WITH to_evict AS (
      SELECT id
      FROM public.user_sessions
      WHERE user_id = v_user_id
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
      OFFSET v_max_sessions
    )
    DELETE FROM public.user_sessions us
    USING to_evict te
    WHERE us.id = te.id;

    GET DIAGNOSTICS v_evicted_count = ROW_COUNT;
  END IF;

  SELECT count(*) INTO v_session_count
  FROM public.user_sessions
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'active_sessions', v_session_count,
    'evicted', v_evicted_count
  );
END;
$function$;