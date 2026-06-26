-- ============================================
-- MIGRATION: Suporte a Rascunhos (drafts) para Imóveis e Leads
-- ============================================
-- Adiciona a capacidade de salvar imóveis e leads como rascunho,
-- visível para toda a organização, registrando quem editou por último.
-- Modelagem escolhida: coluna booleana is_draft + last_edited_by
-- (ortogonal aos enums de status/stage existentes).

-- 1. PROPERTIES
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. LEADS
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Índices para filtrar rascunhos por organização rapidamente
CREATE INDEX IF NOT EXISTS idx_properties_org_is_draft
  ON public.properties(organization_id, is_draft);

CREATE INDEX IF NOT EXISTS idx_leads_org_is_draft
  ON public.leads(organization_id, is_draft);

-- 4. Backfill: registros existentes não são rascunho (já garantido pelo DEFAULT false),
--    e last_edited_by recebe o autor original como ponto de partida.
UPDATE public.properties SET last_edited_by = created_by WHERE last_edited_by IS NULL;
UPDATE public.leads SET last_edited_by = created_by WHERE last_edited_by IS NULL;

-- Observação sobre RLS:
-- As políticas existentes de properties/leads já são por organization_id,
-- portanto rascunhos ficam visíveis para toda a organização sem alterações
-- adicionais de RLS. last_edited_by é apenas informativo.
