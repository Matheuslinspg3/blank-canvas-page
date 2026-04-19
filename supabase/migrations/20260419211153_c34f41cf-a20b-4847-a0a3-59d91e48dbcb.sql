
-- Phase 3B: Meta messaging infrastructure
-- 1) Credentials table (server-side only, never exposed to client)
CREATE TABLE IF NOT EXISTS public.channel_account_credentials (
  channel_account_id uuid PRIMARY KEY REFERENCES public.channel_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text NOT NULL,
  token_type text,
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  external_business_id text,
  external_page_id text,
  external_ig_user_id text,
  webhook_verify_token text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chan_acc_creds_org ON public.channel_account_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_chan_acc_creds_page ON public.channel_account_credentials(external_page_id) WHERE external_page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chan_acc_creds_ig ON public.channel_account_credentials(external_ig_user_id) WHERE external_ig_user_id IS NOT NULL;

ALTER TABLE public.channel_account_credentials ENABLE ROW LEVEL SECURITY;

-- DENY-ALL for authenticated/anon. Only service_role reads/writes.
-- (No policies = deny by default with RLS enabled.)

CREATE OR REPLACE FUNCTION public.tg_channel_account_credentials_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chan_acc_creds_updated_at ON public.channel_account_credentials;
CREATE TRIGGER trg_chan_acc_creds_updated_at
BEFORE UPDATE ON public.channel_account_credentials
FOR EACH ROW EXECUTE FUNCTION public.tg_channel_account_credentials_updated_at();

-- 2) Feature flag table for Meta messaging rollout (per-org)
CREATE TABLE IF NOT EXISTS public.omnichannel_feature_flags (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  meta_messaging_enabled boolean NOT NULL DEFAULT false,
  meta_messaging_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.omnichannel_feature_flags ENABLE ROW LEVEL SECURITY;

-- Read-only for org members; writes via service_role only
CREATE POLICY "feature_flags_select_org_members"
ON public.omnichannel_feature_flags
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id());

-- 3) Idempotency log for inbound webhook events (dedup)
CREATE TABLE IF NOT EXISTS public.meta_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id text NOT NULL,
  channel_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_type, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_webhook_events_received ON public.meta_webhook_events(received_at DESC);

ALTER TABLE public.meta_webhook_events ENABLE ROW LEVEL SECURITY;
-- service_role only (no policies)
