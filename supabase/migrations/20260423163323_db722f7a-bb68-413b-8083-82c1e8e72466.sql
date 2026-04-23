
-- 1. Tabela broker_whatsapp_channels
CREATE TABLE IF NOT EXISTS public.broker_whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name text UNIQUE,
  instance_token text,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.broker_whatsapp_channels ENABLE ROW LEVEL SECURITY;

-- RLS: select — próprio canal OU membro da mesma org
CREATE POLICY "broker_channel_select" ON public.broker_whatsapp_channels
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id = public.get_user_organization_id()
  );

-- RLS: insert — somente próprio canal + mesma org
CREATE POLICY "broker_channel_insert" ON public.broker_whatsapp_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = public.get_user_organization_id()
  );

-- RLS: update — próprio canal OU admin da org
CREATE POLICY "broker_channel_update" ON public.broker_whatsapp_channels
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin(auth.uid())
  );

-- RLS: delete — somente admin da org
CREATE POLICY "broker_channel_delete" ON public.broker_whatsapp_channels
  FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_broker_whatsapp_channels_updated_at
  BEFORE UPDATE ON public.broker_whatsapp_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Colunas em whatsapp_messages
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'org',
  ADD COLUMN IF NOT EXISTS broker_channel_id uuid REFERENCES public.broker_whatsapp_channels(id);

CREATE INDEX IF NOT EXISTS idx_wa_msg_channel_type ON public.whatsapp_messages(channel_type);
CREATE INDEX IF NOT EXISTS idx_wa_msg_broker_channel ON public.whatsapp_messages(broker_channel_id) WHERE broker_channel_id IS NOT NULL;

-- 3. Coluna em messages (omnichannel)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel_subtype text DEFAULT 'org';

-- 4. Atualizar mirror trigger para suportar broker channels
CREATE OR REPLACE FUNCTION public.mirror_whatsapp_to_omnichannel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_agent_cfg record;
  v_broker_cfg record;
  v_conv_id uuid;
  v_lead_id uuid;
  v_direction public.message_direction;
  v_sender public.message_sender_type;
  v_content_type text;
  v_preview text;
  v_channel_subtype text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.messages
       SET content_text = NEW.message_text,
           media_url    = NEW.media_url
     WHERE source_table = 'whatsapp_messages' AND source_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Determine channel subtype
  v_channel_subtype := COALESCE(NEW.channel_type, 'org');

  -- INSERT path: resolve channel_accounts differently for broker vs org
  IF v_channel_subtype = 'broker' AND NEW.broker_channel_id IS NOT NULL THEN
    -- Broker channel: resolve from broker_whatsapp_channels
    SELECT id, instance_name, phone_number, status, webhook_url
      INTO v_broker_cfg
      FROM public.broker_whatsapp_channels
     WHERE id = NEW.broker_channel_id
     LIMIT 1;

    INSERT INTO public.channel_accounts (
      organization_id, channel_type, external_id, display_name, status,
      source_table, source_id, metadata
    ) VALUES (
      NEW.organization_id,
      'whatsapp',
      COALESCE(v_broker_cfg.instance_name, 'broker_' || NEW.broker_channel_id::text),
      'WhatsApp Corretor',
      COALESCE(v_broker_cfg.status, 'unknown'),
      'broker_whatsapp_channels',
      v_broker_cfg.id,
      jsonb_build_object(
        'phone_number', v_broker_cfg.phone_number,
        'webhook_url', v_broker_cfg.webhook_url,
        'channel_subtype', 'broker'
      )
    )
    ON CONFLICT (organization_id, channel_type, external_id) DO UPDATE
      SET display_name = COALESCE(EXCLUDED.display_name, channel_accounts.display_name),
          status = COALESCE(EXCLUDED.status, channel_accounts.status),
          updated_at = now()
    RETURNING id INTO v_account_id;
  ELSE
    -- Original org channel path
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
  END IF;

  -- Best-effort lead lookup
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

  -- UPSERT conversation
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
    last_message_at = CASE
      WHEN conversations.last_message_at IS NULL THEN EXCLUDED.last_message_at
      WHEN EXCLUDED.last_message_at      IS NULL THEN conversations.last_message_at
      WHEN EXCLUDED.last_message_at > conversations.last_message_at THEN EXCLUDED.last_message_at
      ELSE conversations.last_message_at
    END,
    last_inbound_at = CASE
      WHEN conversations.last_inbound_at IS NULL THEN EXCLUDED.last_inbound_at
      WHEN EXCLUDED.last_inbound_at      IS NULL THEN conversations.last_inbound_at
      WHEN EXCLUDED.last_inbound_at > conversations.last_inbound_at THEN EXCLUDED.last_inbound_at
      ELSE conversations.last_inbound_at
    END,
    last_outbound_at = CASE
      WHEN conversations.last_outbound_at IS NULL THEN EXCLUDED.last_outbound_at
      WHEN EXCLUDED.last_outbound_at      IS NULL THEN conversations.last_outbound_at
      WHEN EXCLUDED.last_outbound_at > conversations.last_outbound_at THEN EXCLUDED.last_outbound_at
      ELSE conversations.last_outbound_at
    END,
    last_message_preview = CASE
      WHEN EXCLUDED.last_message_at IS NOT NULL
           AND EXCLUDED.last_message_at >= COALESCE(conversations.last_message_at, '-infinity'::timestamptz)
           AND COALESCE(EXCLUDED.last_message_preview, '') <> ''
      THEN EXCLUDED.last_message_preview
      ELSE conversations.last_message_preview
    END,
    updated_at = now()
  RETURNING id INTO v_conv_id;

  -- Insert message (idempotent) with channel_subtype
  INSERT INTO public.messages (
    organization_id, conversation_id, channel_account_id, channel_type,
    direction, sender_type, content_type, content_text, media_url,
    external_message_id, sent_at, source_table, source_id, channel_subtype
  ) VALUES (
    NEW.organization_id, v_conv_id, v_account_id, 'whatsapp',
    v_direction, v_sender, v_content_type, NEW.message_text, NEW.media_url,
    NEW.message_id, NEW.timestamp, 'whatsapp_messages', NEW.id, v_channel_subtype
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'mirror_whatsapp_to_omnichannel failed for whatsapp_messages.id=%: % / %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$;
