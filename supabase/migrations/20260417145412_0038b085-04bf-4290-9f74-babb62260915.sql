-- Limpa marketplace_properties órfãos (sem propriedade real correspondente)
-- e dados mockup das organizações de seed.
DELETE FROM public.marketplace_properties mp
WHERE NOT EXISTS (
  SELECT 1 FROM public.properties p WHERE p.id = mp.id
);

-- Garante que as orgs mockup conhecidas fiquem 100% fora do marketplace
DELETE FROM public.marketplace_properties
WHERE organization_id IN (
  'a1b2c3d4-1111-4000-8000-000000000001',
  'a1b2c3d4-2222-4000-8000-000000000002',
  'a1b2c3d4-3333-4000-8000-000000000003'
);