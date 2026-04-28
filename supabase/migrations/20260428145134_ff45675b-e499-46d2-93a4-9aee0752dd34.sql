-- Mudança em massa: todos os imóveis publicados no marketplace devem usar
-- o telefone do PROPRIETÁRIO como contato principal. Quando o proprietário
-- não tiver telefone cadastrado, o RPC public.get_marketplace_contact já
-- aplica fallback automático para o telefone da imobiliária (organization).
--
-- Mantém valores 'custom' intactos (ajustes manuais por imóvel).
UPDATE public.marketplace_properties
SET marketplace_contact_phone_source = 'owner',
    updated_at = now()
WHERE COALESCE(marketplace_contact_phone_source, 'organization') <> 'custom';

-- Atualiza também o default da organização para manter o comportamento
-- consistente para novos imóveis publicados a partir de agora.
UPDATE public.organizations
SET marketplace_default_contact_phone_source = 'owner'
WHERE COALESCE(marketplace_default_contact_phone_source, 'organization') <> 'owner';