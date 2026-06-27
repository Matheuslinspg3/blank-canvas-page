-- ============================================================================
-- Drive Backup (feature por organização, opt-in) — FUNDAÇÃO
--
-- Decisões travadas com o usuário:
--   * Disponível em todos os planos
--   * Só ADMIN da org conecta/configura/dispara
--   * OAuth scope drive.file (o app só enxerga a pasta que cria)
--   * Backup vai para o Google Drive DO CLIENTE (não no nosso banco)
--   * Conteúdo: dados sempre + fotos opcionais (original e/ou thumb)
--   * Frequência: "fixo" (1x/dia em horário da org) OU "de hora em hora"
--     TRAVA: "de hora em hora" só é permitido quando NÃO há fotos no escopo
--   * Pasta atual/ = espelho fiel (exclusões refletem); historico/ = snapshots c/ retenção
--   * Motor: cron 0 * * * * filtra quem está "na hora" (fuso da org)
--
-- Esta migration cria apenas a fundação (config, tokens, runs). O engine de
-- backup e o cron são adicionados em migrations/PRs posteriores.
-- ============================================================================

-- Enums ----------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.backup_frequency AS ENUM ('fixed_daily', 'hourly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.backup_run_status AS ENUM ('pending', 'running', 'success', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Configuração de backup por organização -------------------------------------

CREATE TABLE IF NOT EXISTS public.backup_settings (
  organization_id        uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Ativação
  enabled                boolean NOT NULL DEFAULT false,

  -- Escopo
  include_photos         boolean NOT NULL DEFAULT false,
  photo_original         boolean NOT NULL DEFAULT true,   -- só relevante se include_photos
  photo_thumbnail        boolean NOT NULL DEFAULT false,  -- só relevante se include_photos

  -- Espelho (Opção A): exclusões refletem na pasta atual/; histórico preserva
  mirror_deletions       boolean NOT NULL DEFAULT true,

  -- Retenção do histórico (dias). Snapshots mais antigos são removidos do Drive.
  retention_days         integer NOT NULL DEFAULT 30 CHECK (retention_days IN (7, 30, 90)),

  -- Agenda
  frequency              public.backup_frequency NOT NULL DEFAULT 'fixed_daily',
  -- hora local (0-23) usada quando frequency = 'fixed_daily'
  run_hour               smallint NOT NULL DEFAULT 22 CHECK (run_hour BETWEEN 0 AND 23),
  -- fuso da org (IANA), ex: 'America/Sao_Paulo'. Usado para casar run_hour.
  timezone               text NOT NULL DEFAULT 'America/Sao_Paulo',

  -- Conexão Google Drive (OAuth do cliente). NÃO expor ao cliente via RLS de leitura crua.
  oauth_access_token     text,
  oauth_refresh_token    text,
  oauth_token_expires_at timestamptz,
  drive_account_email    text,
  drive_root_folder_id   text,        -- id da pasta raiz "Portal Corretor Backups" no Drive do cliente
  connected_at           timestamptz,
  connected_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Controle/observabilidade
  last_run_at            timestamptz,
  last_run_status        public.backup_run_status,
  next_run_at            timestamptz,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  -- TRAVA: de hora em hora só sem fotos
  CONSTRAINT backup_hourly_requires_no_photos
    CHECK (frequency <> 'hourly' OR include_photos = false)
);

COMMENT ON TABLE public.backup_settings IS
  'Configuração de backup no Google Drive por organização (opt-in, admin-only). Tokens OAuth ficam aqui mas não são expostos via RLS de leitura crua ao cliente.';

-- Histórico de execuções -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status             public.backup_run_status NOT NULL DEFAULT 'pending',
  trigger            text NOT NULL DEFAULT 'cron' CHECK (trigger IN ('cron', 'manual')),
  triggered_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz,

  -- Métricas do run
  leads_count        integer,
  properties_count   integer,
  photos_uploaded    integer,
  photos_deleted     integer,
  bytes_uploaded     bigint,
  snapshot_folder    text,            -- nome/id da pasta historico/<data> criada
  error_message      text,

  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_org_started
  ON public.backup_runs (organization_id, started_at DESC);

COMMENT ON TABLE public.backup_runs IS 'Log de execuções de backup por organização (cron e manual).';

-- updated_at trigger ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_backup_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backup_settings_updated_at ON public.backup_settings;
CREATE TRIGGER trg_backup_settings_updated_at
  BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_backup_settings_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_runs     ENABLE ROW LEVEL SECURITY;

-- backup_settings: somente ADMIN da própria org pode ver/gerenciar.
-- (Tokens OAuth ficam nesta tabela; ler exige admin. Edge functions usam
--  service role e ignoram RLS.)

DROP POLICY IF EXISTS backup_settings_select ON public.backup_settings;
CREATE POLICY backup_settings_select ON public.backup_settings
  FOR SELECT
  USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

DROP POLICY IF EXISTS backup_settings_insert ON public.backup_settings;
CREATE POLICY backup_settings_insert ON public.backup_settings
  FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

DROP POLICY IF EXISTS backup_settings_update ON public.backup_settings;
CREATE POLICY backup_settings_update ON public.backup_settings
  FOR UPDATE
  USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

DROP POLICY IF EXISTS backup_settings_delete ON public.backup_settings;
CREATE POLICY backup_settings_delete ON public.backup_settings
  FOR DELETE
  USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

-- backup_runs: admin da org pode ler o histórico (escrita é via service role).

DROP POLICY IF EXISTS backup_runs_select ON public.backup_runs;
CREATE POLICY backup_runs_select ON public.backup_runs
  FOR SELECT
  USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));
