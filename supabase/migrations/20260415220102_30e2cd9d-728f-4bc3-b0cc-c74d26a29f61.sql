-- ============================================================
-- 1. Create security_audit_events (append-only audit trail)
-- ============================================================
CREATE TABLE public.security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  endpoint text,
  actor_type text NOT NULL DEFAULT 'user',
  actor_user_id uuid,
  actor_org_id uuid,
  target_type text,
  target_id text,
  decision text NOT NULL,
  reason_code text,
  request_id text,
  ip inet,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  prev_hash text,
  event_hash text
);

ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

-- Only developers can read audit events
CREATE POLICY "Developers can read security audit"
  ON public.security_audit_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- No INSERT/UPDATE/DELETE for authenticated — writes via service_role only

-- Indexes for common queries
CREATE INDEX idx_security_audit_created ON public.security_audit_events (created_at DESC);
CREATE INDEX idx_security_audit_type_severity ON public.security_audit_events (event_type, severity);
CREATE INDEX idx_security_audit_actor ON public.security_audit_events (actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_security_audit_target ON public.security_audit_events (target_id) WHERE target_id IS NOT NULL;

-- ============================================================
-- 2. Drop INSERT/UPDATE/DELETE policies on user_roles
--    Keep only SELECT policy ("Users view roles in same org")
-- ============================================================
DROP POLICY IF EXISTS "Org admins can insert roles (no escalation)" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role updates" ON public.user_roles;
DROP POLICY IF EXISTS "Secure role deletion" ON public.user_roles;