-- =====================================================
-- OMNICHANNEL FOUNDATION (Fase 1)
-- Non-destructive: whatsapp_messages remains intact
-- =====================================================

-- 1. ENUMS (idempotent)
DO $$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('whatsapp','instagram','messenger','facebook_comments','sms','email','webchat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_status AS ENUM ('open','pending','assigned','snoozed','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_sender_type AS ENUM ('customer','agent','ai','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. channel_accounts
CREATE TABLE IF NOT EXISTS public.channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_type public.channel_type NOT NULL,
  external_id text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_table text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_accounts_unique UNIQUE (organization_id, channel_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_accounts_org ON public.channel_accounts(organization_id);

ALTER TABLE public.channel_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_accounts_manager_select" ON public.channel_accounts;
CREATE POLICY "channel_accounts_manager_select" ON public.channel_accounts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "channel_accounts_manager_all" ON public.channel_accounts;
CREATE POLICY "channel_accounts_manager_all" ON public.channel_accounts
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));

-- 3. conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id) ON DELETE CASCADE,
  channel_type public.channel_type NOT NULL,
  external_contact_id text NOT NULL,
  customer_display_name text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status public.conversation_status NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_preview text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_unique_per_account UNIQUE (channel_account_id, external_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_org_last_msg ON public.conversations(organization_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status ON public.conversations(organization_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON public.conversations(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_manager_select" ON public.conversations;
CREATE POLICY "conversations_manager_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "conversations_broker_select" ON public.conversations;
CREATE POLICY "conversations_broker_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND lead_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = conversations.lead_id AND l.broker_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversations_manager_update" ON public.conversations;
CREATE POLICY "conversations_manager_update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));

-- 4. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  channel_account_id uuid NOT NULL REFERENCES public.channel_accounts(id) ON DELETE CASCADE,
  channel_type public.channel_type NOT NULL,
  direction public.message_direction NOT NULL,
  sender_type public.message_sender_type,
  content_type text NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text','image','audio','video','document','location','sticker','contact','reaction','system')),
  content_text text,
  media_url text,
  external_message_id text,
  sent_at timestamptz NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_source_unique UNIQUE (source_table, source_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_external_unique
  ON public.messages(conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conv_sent ON public.messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_sent ON public.messages(organization_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_account_sent ON public.messages(channel_account_id, sent_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_manager_select" ON public.messages;
CREATE POLICY "messages_manager_select" ON public.messages
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "messages_broker_select" ON public.messages;
CREATE POLICY "messages_broker_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.leads l ON l.id = c.lead_id
      WHERE c.id = messages.conversation_id AND l.broker_id = auth.uid()
    )
  );

-- 5. inbox_assignments
CREATE TABLE IF NOT EXISTS public.inbox_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  assigned_by uuid,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','collaborator')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_inbox_assignments_active ON public.inbox_assignments(conversation_id) WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_assignments_one_owner
  ON public.inbox_assignments(conversation_id) WHERE unassigned_at IS NULL AND role = 'owner';
CREATE INDEX IF NOT EXISTS idx_inbox_assignments_user ON public.inbox_assignments(assigned_to) WHERE unassigned_at IS NULL;

ALTER TABLE public.inbox_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inbox_assignments_manager_all" ON public.inbox_assignments;
CREATE POLICY "inbox_assignments_manager_all" ON public.inbox_assignments
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "inbox_assignments_self_select" ON public.inbox_assignments;
CREATE POLICY "inbox_assignments_self_select" ON public.inbox_assignments
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id() AND assigned_to = auth.uid());

-- 6. updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_channel_accounts ON public.channel_accounts;
CREATE TRIGGER set_updated_at_channel_accounts
  BEFORE UPDATE ON public.channel_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_conversations ON public.conversations;
CREATE TRIGGER set_updated_at_conversations
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Mirror function (NEVER blocks production)
CREATE OR REPLACE FUNCTION public.mirror_whatsapp_to_omnichannel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_agent_cfg record;
  v_conv_id uuid;
  v_lead_id uuid;
  v_phone_norm text;
  v_direction public.message_direction;
  v_sender public.message_sender_type;
  v_content_type text;
  v_preview text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- UPDATE path: only propagate mutable content fields, never touch conversation/counters/timestamps
    UPDATE public.messages
       SET content_text = NEW.message_text,
           media_url = NEW.media_url
     WHERE source_table = 'whatsapp_messages' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- INSERT path
  -- Resolve channel account from whatsapp_agent_config (source of truth)
  SELECT id, agent_name, phone_number, status, webhook_url
    INTO v_agent_cfg
    FROM public.whatsapp_agent_config
   WHERE organization_id = NEW.organization_id
     AND instance_name = NEW.instance_name
   LIMIT 1;

  INSERT INTO public.channel_accounts (
    organization_id, channel_type, external_id, display_name, status,
    source_table, source_id, metadata
  ) VALUES (
    NEW.organization_id,
    'whatsapp',
    NEW.instance_name,
    COALESCE(v_agent_cfg.agent_name, NEW.instance_name),
    COALESCE(v_agent_cfg.status, 'unknown'),
    'whatsapp_agent_config',
    v_agent_cfg.id,
    jsonb_build_object(
      'phone_number', v_agent_cfg.phone_number,
      'webhook_url', v_agent_cfg.webhook_url
    )
  )
  ON CONFLICT (organization_id, channel_type, external_id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, channel_accounts.display_name),
        status = COALESCE(EXCLUDED.status, channel_accounts.status),
        updated_at = now()
  RETURNING id INTO v_account_id;

  -- Best-effort lead lookup with explicit ambiguity detection
  WITH normalized AS (
    SELECT regexp_replace(split_part(NEW.remote_jid, '@', 1), '\D', '', 'g') AS phone_norm
  ),
  matches AS (
    SELECT l.id
      FROM public.leads l, normalized n
     WHERE l.organization_id = NEW.organization_id
       AND n.phone_norm <> ''
       AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') = n.phone_norm
     LIMIT 2
  ),
  agg AS (
    SELECT array_agg(id) AS ids, COUNT(*) AS n FROM matches
  )
  SELECT CASE WHEN n = 1 THEN ids[1] ELSE NULL END
    INTO v_lead_id
    FROM agg;

  -- Direction & sender mapping
  v_direction := CASE WHEN NEW.from_me THEN 'outbound'::public.message_direction
                      ELSE 'inbound'::public.message_direction END;

  v_sender := CASE NEW.sender_type
                WHEN 'customer' THEN 'customer'::public.message_sender_type
                WHEN 'agent' THEN 'agent'::public.message_sender_type
                WHEN 'human' THEN 'agent'::public.message_sender_type
                WHEN 'ai' THEN 'ai'::public.message_sender_type
                ELSE NULL
              END;

  v_content_type := CASE NEW.message_type
                      WHEN 'text' THEN 'text'
                      WHEN 'image' THEN 'image'
                      WHEN 'audio' THEN 'audio'
                      WHEN 'video' THEN 'video'
                      WHEN 'document' THEN 'document'
                      WHEN 'location' THEN 'location'
                      WHEN 'sticker' THEN 'sticker'
                      WHEN 'contact' THEN 'contact'
                      ELSE 'text'
                    END;

  v_preview := LEFT(COALESCE(NEW.message_text, ''), 200);

  -- UPSERT conversation with progressive enrichment, null-safe timestamps
  INSERT INTO public.conversations (
    organization_id, channel_account_id, channel_type, external_contact_id,
    customer_display_name, lead_id, status,
    last_message_at, last_inbound_at, last_outbound_at, last_message_preview
  ) VALUES (
    NEW.organization_id, v_account_id, 'whatsapp', NEW.remote_jid,
    NULL, v_lead_id, 'open',
    NEW.timestamp,
    CASE WHEN NEW.from_me = false THEN NEW.timestamp ELSE NULL END,
    CASE WHEN NEW.from_me = true  THEN NEW.timestamp ELSE NULL END,
    v_preview
  )
  ON CONFLICT (channel_account_id, external_contact_id) DO UPDATE SET
    lead_id               = COALESCE(conversations.lead_id, EXCLUDED.lead_id),
    customer_display_name = COALESCE(conversations.customer_display_name, EXCLUDED.customer_display_name),
    last_message_at  = GREATEST(conversations.last_message_at,  EXCLUDED.last_message_at),
    last_inbound_at  = GREATEST(conversations.last_inbound_at,  EXCLUDED.last_inbound_at),
    last_outbound_at = GREATEST(conversations.last_outbound_at, EXCLUDED.last_outbound_at),
    last_message_preview = CASE
      WHEN EXCLUDED.last_message_at IS NOT NULL
           AND EXCLUDED.last_message_at >= COALESCE(conversations.last_message_at, '-infinity'::timestamptz)
           AND COALESCE(EXCLUDED.last_message_preview, '') <> ''
      THEN EXCLUDED.last_message_preview
      ELSE conversations.last_message_preview
    END,
    updated_at = now()
  RETURNING id INTO v_conv_id;

  -- Insert message (idempotent)
  INSERT INTO public.messages (
    organization_id, conversation_id, channel_account_id, channel_type,
    direction, sender_type, content_type, content_text, media_url,
    external_message_id, sent_at, source_table, source_id
  ) VALUES (
    NEW.organization_id, v_conv_id, v_account_id, 'whatsapp',
    v_direction, v_sender, v_content_type, NEW.message_text, NEW.media_url,
    NEW.message_id, NEW.timestamp, 'whatsapp_messages', NEW.id
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mirror_whatsapp_to_omnichannel failed for whatsapp_messages.id=%: % / %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;

-- 8. Triggers on whatsapp_messages
DROP TRIGGER IF EXISTS mirror_whatsapp_to_omnichannel_ins ON public.whatsapp_messages;
CREATE TRIGGER mirror_whatsapp_to_omnichannel_ins
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.mirror_whatsapp_to_omnichannel();

DROP TRIGGER IF EXISTS mirror_whatsapp_to_omnichannel_upd ON public.whatsapp_messages;
CREATE TRIGGER mirror_whatsapp_to_omnichannel_upd
  AFTER UPDATE ON public.whatsapp_messages
  FOR EACH ROW
  WHEN (OLD.message_text IS DISTINCT FROM NEW.message_text OR OLD.media_url IS DISTINCT FROM NEW.media_url)
  EXECUTE FUNCTION public.mirror_whatsapp_to_omnichannel();

-- 9. Backfill function (idempotent, manual)
CREATE OR REPLACE FUNCTION public.backfill_omnichannel_from_whatsapp(
  p_org_id uuid DEFAULT NULL,
  p_batch_size int DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_batches int := 0;
  v_msg record;
  v_account_id uuid;
  v_agent_cfg record;
  v_conv_id uuid;
  v_lead_id uuid;
  v_direction public.message_direction;
  v_sender public.message_sender_type;
  v_content_type text;
BEGIN
  FOR v_msg IN
    SELECT wm.*
      FROM public.whatsapp_messages wm
     WHERE (p_org_id IS NULL OR wm.organization_id = p_org_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.messages m
          WHERE m.source_table = 'whatsapp_messages' AND m.source_id = wm.id
       )
     ORDER BY wm.timestamp ASC
     LIMIT p_batch_size
  LOOP
    BEGIN
      SELECT id, agent_name, phone_number, status, webhook_url
        INTO v_agent_cfg
        FROM public.whatsapp_agent_config
       WHERE organization_id = v_msg.organization_id
         AND instance_name = v_msg.instance_name
       LIMIT 1;

      INSERT INTO public.channel_accounts (
        organization_id, channel_type, external_id, display_name, status,
        source_table, source_id, metadata
      ) VALUES (
        v_msg.organization_id, 'whatsapp', v_msg.instance_name,
        COALESCE(v_agent_cfg.agent_name, v_msg.instance_name),
        COALESCE(v_agent_cfg.status, 'unknown'),
        'whatsapp_agent_config', v_agent_cfg.id,
        jsonb_build_object('phone_number', v_agent_cfg.phone_number, 'webhook_url', v_agent_cfg.webhook_url)
      )
      ON CONFLICT (organization_id, channel_type, external_id) DO UPDATE
        SET updated_at = now()
      RETURNING id INTO v_account_id;

      WITH normalized AS (
        SELECT regexp_replace(split_part(v_msg.remote_jid, '@', 1), '\D', '', 'g') AS phone_norm
      ),
      matches AS (
        SELECT l.id FROM public.leads l, normalized n
         WHERE l.organization_id = v_msg.organization_id
           AND n.phone_norm <> ''
           AND regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g') = n.phone_norm
         LIMIT 2
      ),
      agg AS (SELECT array_agg(id) AS ids, COUNT(*) AS n FROM matches)
      SELECT CASE WHEN n = 1 THEN ids[1] ELSE NULL END INTO v_lead_id FROM agg;

      INSERT INTO public.conversations (
        organization_id, channel_account_id, channel_type, external_contact_id,
        lead_id, status
      ) VALUES (
        v_msg.organization_id, v_account_id, 'whatsapp', v_msg.remote_jid,
        v_lead_id, 'open'
      )
      ON CONFLICT (channel_account_id, external_contact_id) DO UPDATE SET
        lead_id = COALESCE(conversations.lead_id, EXCLUDED.lead_id)
      RETURNING id INTO v_conv_id;

      v_direction := CASE WHEN v_msg.from_me THEN 'outbound'::public.message_direction
                          ELSE 'inbound'::public.message_direction END;
      v_sender := CASE v_msg.sender_type
                    WHEN 'customer' THEN 'customer'::public.message_sender_type
                    WHEN 'agent' THEN 'agent'::public.message_sender_type
                    WHEN 'human' THEN 'agent'::public.message_sender_type
                    WHEN 'ai' THEN 'ai'::public.message_sender_type
                    ELSE NULL END;
      v_content_type := CASE v_msg.message_type
                          WHEN 'text' THEN 'text' WHEN 'image' THEN 'image'
                          WHEN 'audio' THEN 'audio' WHEN 'video' THEN 'video'
                          WHEN 'document' THEN 'document' WHEN 'location' THEN 'location'
                          WHEN 'sticker' THEN 'sticker' WHEN 'contact' THEN 'contact'
                          ELSE 'text' END;

      INSERT INTO public.messages (
        organization_id, conversation_id, channel_account_id, channel_type,
        direction, sender_type, content_type, content_text, media_url,
        external_message_id, sent_at, source_table, source_id
      ) VALUES (
        v_msg.organization_id, v_conv_id, v_account_id, 'whatsapp',
        v_direction, v_sender, v_content_type, v_msg.message_text, v_msg.media_url,
        v_msg.message_id, v_msg.timestamp, 'whatsapp_messages', v_msg.id
      )
      ON CONFLICT (source_table, source_id) DO NOTHING;

      v_total := v_total + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'backfill skipped wm.id=%: %', v_msg.id, SQLERRM;
    END;
  END LOOP;

  v_batches := 1;

  -- Recompute conversation aggregates from messages (consistent post-backfill)
  UPDATE public.conversations c
     SET last_message_at  = agg.last_at,
         last_inbound_at  = agg.last_in,
         last_outbound_at = agg.last_out,
         last_message_preview = LEFT(COALESCE(agg.last_text, ''), 200),
         updated_at = now()
    FROM (
      SELECT m.conversation_id,
             MAX(m.sent_at) AS last_at,
             MAX(m.sent_at) FILTER (WHERE m.direction = 'inbound')  AS last_in,
             MAX(m.sent_at) FILTER (WHERE m.direction = 'outbound') AS last_out,
             (SELECT content_text FROM public.messages mm
               WHERE mm.conversation_id = m.conversation_id
                 AND mm.content_text IS NOT NULL AND mm.content_text <> ''
               ORDER BY mm.sent_at DESC LIMIT 1) AS last_text
        FROM public.messages m
       WHERE (p_org_id IS NULL OR m.organization_id = p_org_id)
       GROUP BY m.conversation_id
    ) agg
   WHERE c.id = agg.conversation_id;

  RETURN jsonb_build_object(
    'processed', v_total,
    'batches', v_batches,
    'remaining_hint', 'rerun if processed = batch_size'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_omnichannel_from_whatsapp(uuid, int) FROM PUBLIC;