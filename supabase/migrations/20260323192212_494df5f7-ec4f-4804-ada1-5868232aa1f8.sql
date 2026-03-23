-- Table to track active user sessions (max 2 per user)
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  device_type text NOT NULL DEFAULT 'desktop',
  device_info text,
  ip_address text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_token)
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_seen ON public.user_sessions(last_seen_at);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to register a session and evict oldest if >2
CREATE OR REPLACE FUNCTION public.register_session(
  p_session_token text,
  p_device_type text DEFAULT 'desktop',
  p_device_info text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_session_count int;
  v_evicted_tokens text[];
  v_max_sessions int := 2;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Upsert current session
  INSERT INTO public.user_sessions (user_id, session_token, device_type, device_info, ip_address, last_seen_at)
  VALUES (v_user_id, p_session_token, p_device_type, p_device_info, p_ip_address, now())
  ON CONFLICT (session_token) DO UPDATE SET
    last_seen_at = now(),
    device_type = EXCLUDED.device_type,
    device_info = EXCLUDED.device_info;

  -- Count active sessions
  SELECT count(*) INTO v_session_count
  FROM public.user_sessions
  WHERE user_id = v_user_id;

  -- If over limit, evict oldest sessions
  IF v_session_count > v_max_sessions THEN
    WITH to_evict AS (
      SELECT id, session_token
      FROM public.user_sessions
      WHERE user_id = v_user_id
      ORDER BY last_seen_at DESC
      OFFSET v_max_sessions
    )
    DELETE FROM public.user_sessions
    WHERE id IN (SELECT id FROM to_evict)
    RETURNING session_token INTO v_evicted_tokens;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'active_sessions', LEAST(v_session_count, v_max_sessions),
    'evicted', COALESCE(array_length(v_evicted_tokens, 1), 0)
  );
END;
$$;

-- Function to heartbeat (update last_seen)
CREATE OR REPLACE FUNCTION public.session_heartbeat(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_seen_at = now()
  WHERE session_token = p_session_token
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to check if session is still valid
CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE session_token = p_session_token
      AND user_id = auth.uid()
  );
END;
$$;

-- Enable realtime for session eviction notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;