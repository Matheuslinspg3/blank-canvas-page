-- Configuração por organização: origem padrão do telefone do Marketplace.
-- Aditivo. NÃO altera imóveis existentes (nenhum UPDATE em properties / marketplace_properties).
-- Aplica-se apenas como default para NOVOS imóveis quando o cliente não enviar marketplace_contact_phone_source.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS marketplace_default_contact_phone_source text
    NOT NULL DEFAULT 'organization';

COMMENT ON COLUMN public.organizations.marketplace_default_contact_phone_source IS
  'Origem padrão do telefone exibido no Marketplace para NOVOS imóveis criados nesta organização. Valores aceitos: organization | owner. Não sobrescreve imóveis existentes.';

CREATE OR REPLACE FUNCTION public.validate_org_marketplace_default_phone_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.marketplace_default_contact_phone_source IS NULL THEN
    NEW.marketplace_default_contact_phone_source := 'organization';
  ELSE
    NEW.marketplace_default_contact_phone_source :=
      lower(btrim(NEW.marketplace_default_contact_phone_source));
    IF NEW.marketplace_default_contact_phone_source NOT IN ('organization','owner') THEN
      RAISE EXCEPTION 'Origem padrão do telefone do Marketplace inválida: % (aceitos: organization, owner)',
        NEW.marketplace_default_contact_phone_source
        USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_org_mp_default_phone_source ON public.organizations;
CREATE TRIGGER trg_validate_org_mp_default_phone_source
  BEFORE INSERT OR UPDATE OF marketplace_default_contact_phone_source
  ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_org_marketplace_default_phone_source();