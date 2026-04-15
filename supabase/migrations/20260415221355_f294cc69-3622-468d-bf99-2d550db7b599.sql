-- Security feature flags table for gradual rollout
CREATE TABLE public.security_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'observe' CHECK (mode IN ('observe', 'dual', 'enforce')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can read flags" ON public.security_feature_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- Seed initial flags
INSERT INTO public.security_feature_flags (flag_key, enabled, mode, description) VALUES
  ('SEC_ENFORCE_USER_ROLES_VIA_MANAGE_MEMBER', true, 'enforce', 'Block direct user_roles mutation from frontend'),
  ('SEC_ENFORCE_AI_ROUTER_DERIVED_ORG', true, 'enforce', 'Derive org_id from JWT in ai-router, ignore body'),
  ('SEC_ENFORCE_SEND_PUSH_STRICT_AUTH', true, 'enforce', 'Require role + org scope for send-push'),
  ('SEC_ENFORCE_WEBHOOK_HMAC', false, 'dual', 'Validate HMAC signatures on webhook calls'),
  ('SEC_ENABLE_RESET_EMAIL_ANTI_ABUSE', true, 'enforce', 'Rate limit send-reset-email by IP and email'),
  ('SEC_ENFORCE_PLATFORM_SIGNUP_SIGNED_INVITES', false, 'dual', 'Require signed invite tokens for platform-signup'),
  ('SEC_ENFORCE_M2M_INTERNAL_AUTH', false, 'dual', 'Require signed M2M auth for internal calls');

-- Signup attempt log for anti-bruteforce
CREATE TABLE public.signup_attempt_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  email text,
  invite_id text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_attempt_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for authenticated - only service_role reads this