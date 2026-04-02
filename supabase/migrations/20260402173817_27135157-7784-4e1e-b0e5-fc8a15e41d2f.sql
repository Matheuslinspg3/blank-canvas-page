-- Tabela para armazenar intents de contato do Marketplace
CREATE TABLE public.marketplace_contact_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_phone text NOT NULL,
  contact_type text NOT NULL DEFAULT 'broker' CHECK (contact_type IN ('broker', 'org')),
  property_id uuid,
  property_title text,
  property_code text,
  property_location text,
  property_price numeric,
  property_transaction_type text,
  source_org_name text,
  broker_name text,
  org_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumer_phone text
);

CREATE INDEX idx_mci_target_pending ON public.marketplace_contact_intents (target_phone, organization_id)
  WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION public.cleanup_old_marketplace_intents()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.marketplace_contact_intents WHERE created_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_marketplace_intents
  AFTER INSERT ON public.marketplace_contact_intents
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_marketplace_intents();

ALTER TABLE public.marketplace_contact_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert marketplace intents"
  ON public.marketplace_contact_intents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Org members can read own intents"
  ON public.marketplace_contact_intents FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.consume_marketplace_intent(
  p_target_phone text, p_consumer_phone text, p_organization_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_intent marketplace_contact_intents%ROWTYPE;
  v_clean_target text;
BEGIN
  v_clean_target := RIGHT(regexp_replace(p_target_phone, '\D', '', 'g'), 8);
  SELECT * INTO v_intent FROM marketplace_contact_intents
  WHERE RIGHT(regexp_replace(target_phone, '\D', '', 'g'), 8) = v_clean_target
    AND organization_id = p_organization_id AND consumed_at IS NULL
    AND created_at > now() - interval '1 hour'
  ORDER BY created_at DESC LIMIT 1;
  IF v_intent.id IS NULL THEN RETURN NULL; END IF;
  UPDATE marketplace_contact_intents SET consumed_at = now(), consumer_phone = p_consumer_phone WHERE id = v_intent.id;
  RETURN jsonb_build_object(
    'property_title', v_intent.property_title, 'property_code', v_intent.property_code,
    'property_location', v_intent.property_location, 'property_price', v_intent.property_price,
    'property_transaction_type', v_intent.property_transaction_type, 'contact_type', v_intent.contact_type,
    'broker_name', v_intent.broker_name, 'org_name', v_intent.org_name,
    'source_org_name', v_intent.source_org_name, 'source', 'porta_do_corretor'
  );
END;
$$;