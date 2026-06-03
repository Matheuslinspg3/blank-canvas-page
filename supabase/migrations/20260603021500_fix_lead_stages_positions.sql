-- ============================================================
-- FIX: Reordenar posições do funil de leads
-- Problema: posições 4, 6, 7 faltam (0,1,2,3,5,8,9)
-- Correção: normalizar para sequência 0-6 contínua
-- ============================================================

-- Reordenar lead_stages para posições sequenciais (org específica)
-- Posições atuais: 0(LEAD NOVO), 1(LEAD), 2(Futuro), 3(Interesse), 5(Proposta), 8(Locação), 9(Pós Vendas)
-- Novas posições:  0(LEAD NOVO), 1(LEAD), 2(Futuro), 3(Interesse), 4(Proposta), 5(Locação), 6(Pós Vendas)

UPDATE public.lead_stages SET position = 4 
WHERE organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28' AND position = 5;

UPDATE public.lead_stages SET position = 5 
WHERE organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28' AND position = 8;

UPDATE public.lead_stages SET position = 6 
WHERE organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28' AND position = 9;
