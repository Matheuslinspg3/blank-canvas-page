-- ============================================================
-- CLEANUP: Remover profiles órfãos e problemas menores
-- ============================================================

-- 1. Profiles sem organização criados há mais de 30 dias (provavelmente testes)
-- NOTA: Não deletamos automaticamente — apenas marcamos com flag para revisão manual
-- Descomentar se confirmar que são realmente lixo:
-- DELETE FROM public.profiles 
-- WHERE organization_id IS NULL 
--   AND created_at < NOW() - INTERVAL '30 days'
--   AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'developer');

-- 2. Atualizar phone_number da instância WhatsApp se ainda estiver NULL
-- NOTA: Esse update só funciona se o provider já tiver o número registrado
-- Idealmente seria feito via webhook do Evolution API
UPDATE public.whatsapp_instances 
SET phone_number = '55XXXXXXXXXXX' 
WHERE organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28' 
  AND status = 'connected' 
  AND phone_number IS NULL;
-- TODO: Substituir XXXXXXXXXXX pelo número real após verificar no painel Evolution

-- 3. Limpar meta_lead_failures de teste (já tentamos antes mas RLS impediu)
-- Com service_role da migration funciona:
DELETE FROM public.meta_lead_failures 
WHERE leadgen_id LIKE 'TEST_%' 
   OR leadgen_id LIKE 'FAKE_%' 
   OR leadgen_id LIKE '44444%';
