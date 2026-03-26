-- ============================================================
-- Seed script para ambiente de desenvolvimento
-- Insere dados de exemplo para onboarding rápido de novos devs
-- Uso: psql -f seed-dev-data.sql
-- ============================================================

-- IMPORTANTE: Substitua este UUID pelo ID de um usuário criado via auth.users
-- e o org_id pelo ID da organização de teste.

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_org_id  UUID := '00000000-0000-0000-0000-000000000010';
  v_prop1   UUID := gen_random_uuid();
  v_prop2   UUID := gen_random_uuid();
  v_prop3   UUID := gen_random_uuid();
  v_lead1   UUID := gen_random_uuid();
  v_lead2   UUID := gen_random_uuid();
  v_lead3   UUID := gen_random_uuid();
  v_stage1  UUID;
  v_stage2  UUID;
BEGIN

-- ---- Organization ----
INSERT INTO organizations (id, name, slug) 
VALUES (v_org_id, 'Imobiliária Dev', 'imobiliaria-dev')
ON CONFLICT (id) DO NOTHING;

-- ---- Profile ----
INSERT INTO profiles (id, organization_id, full_name, email, role)
VALUES (v_user_id, v_org_id, 'Dev Teste', 'dev@teste.com', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ---- Lead Stages ----
INSERT INTO lead_stages (id, organization_id, name, color, position)
VALUES 
  (gen_random_uuid(), v_org_id, 'Novo', '#3B82F6', 0),
  (gen_random_uuid(), v_org_id, 'Qualificado', '#F59E0B', 1),
  (gen_random_uuid(), v_org_id, 'Visita Agendada', '#8B5CF6', 2),
  (gen_random_uuid(), v_org_id, 'Proposta', '#10B981', 3),
  (gen_random_uuid(), v_org_id, 'Fechado', '#22C55E', 4),
  (gen_random_uuid(), v_org_id, 'Perdido', '#EF4444', 5)
ON CONFLICT DO NOTHING;

SELECT id INTO v_stage1 FROM lead_stages WHERE organization_id = v_org_id AND position = 0 LIMIT 1;
SELECT id INTO v_stage2 FROM lead_stages WHERE organization_id = v_org_id AND position = 1 LIMIT 1;

-- ---- Properties ----
INSERT INTO properties (id, organization_id, title, description, type, status, transaction_type, price, area, bedrooms, bathrooms, parking_spots, address, city, state, zip_code, created_by)
VALUES
  (v_prop1, v_org_id, 'Apartamento Centro 3Q', 'Apartamento amplo com 3 quartos, varanda gourmet e 2 vagas.', 'apartamento', 'disponivel', 'venda', 450000, 95, 3, 2, 2, 'Rua das Flores, 100', 'São Paulo', 'SP', '01001-000', v_user_id),
  (v_prop2, v_org_id, 'Casa Jardim Europa', 'Casa térrea com piscina, churrasqueira e quintal amplo.', 'casa', 'disponivel', 'venda', 890000, 250, 4, 3, 3, 'Av. Brasil, 500', 'São Paulo', 'SP', '01430-000', v_user_id),
  (v_prop3, v_org_id, 'Sala Comercial 40m²', 'Sala comercial em edifício AAA, pronta para uso.', 'comercial', 'disponivel', 'locacao', 3500, 40, 0, 1, 1, 'Av. Paulista, 1000', 'São Paulo', 'SP', '01310-100', v_user_id)
ON CONFLICT (id) DO NOTHING;

-- ---- Leads ----
INSERT INTO leads (id, organization_id, name, email, phone, source, stage_id, broker_id, property_id, budget_min, budget_max, is_active)
VALUES
  (v_lead1, v_org_id, 'João Silva', 'joao@email.com', '11999990001', 'site', v_stage1, v_user_id, v_prop1, 300000, 500000, true),
  (v_lead2, v_org_id, 'Maria Oliveira', 'maria@email.com', '11999990002', 'indicacao', v_stage2, v_user_id, v_prop2, 700000, 1000000, true),
  (v_lead3, v_org_id, 'Carlos Souza', 'carlos@email.com', '11999990003', 'portal', v_stage1, v_user_id, NULL, 2000, 5000, true)
ON CONFLICT (id) DO NOTHING;

-- ---- Transaction Categories ----
INSERT INTO transaction_categories (id, organization_id, name, type)
VALUES
  (gen_random_uuid(), v_org_id, 'Comissões', 'receita'),
  (gen_random_uuid(), v_org_id, 'Aluguéis', 'receita'),
  (gen_random_uuid(), v_org_id, 'Marketing', 'despesa'),
  (gen_random_uuid(), v_org_id, 'Escritório', 'despesa')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Seed concluído! Org: %, User: %', v_org_id, v_user_id;
END $$;
