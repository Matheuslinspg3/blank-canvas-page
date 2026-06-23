
-- 1) Permitir organization_id NULL (catálogo global)
ALTER TABLE public.property_amenities ALTER COLUMN organization_id DROP NOT NULL;

-- 2) Substituir UNIQUE para tratar NULL como valor distinto e ser case-insensitive
ALTER TABLE public.property_amenities DROP CONSTRAINT IF EXISTS property_amenities_organization_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS property_amenities_org_name_unique
  ON public.property_amenities (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- 3) Atualizar políticas RLS: SELECT vê globais + da própria org
DROP POLICY IF EXISTS "Members can view org amenities" ON public.property_amenities;
CREATE POLICY "Members can view amenities (global + own org)"
  ON public.property_amenities
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT profiles.organization_id FROM public.profiles WHERE profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can create amenities" ON public.property_amenities;
CREATE POLICY "Members can create amenities"
  ON public.property_amenities
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Owner or admin can update amenities" ON public.property_amenities;
CREATE POLICY "Owner or admin can update amenities"
  ON public.property_amenities
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sub_admin'::app_role))
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
  );

DROP POLICY IF EXISTS "Owner or admin can delete amenities" ON public.property_amenities;
CREATE POLICY "Owner or admin can delete amenities"
  ON public.property_amenities
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
    AND is_default = false
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sub_admin'::app_role))
  );

-- 4) Seed do catálogo global: pega cada nome único (case-insensitive) já usado,
--    escolhe a categoria mais frequente, insere como global (organization_id NULL, is_default true).
WITH ranked AS (
  SELECT lower(name) AS lname, name, category, COUNT(*) AS c,
         ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY COUNT(*) DESC, MIN(name)) AS rn
  FROM public.property_amenities
  WHERE name IS NOT NULL AND length(trim(name)) > 0
  GROUP BY lower(name), name, category
),
picked AS (
  SELECT DISTINCT ON (lname)
    lname,
    FIRST_VALUE(name) OVER (PARTITION BY lname ORDER BY c DESC) AS name,
    FIRST_VALUE(category) OVER (PARTITION BY lname ORDER BY c DESC) AS category
  FROM ranked
)
INSERT INTO public.property_amenities (organization_id, name, category, is_default, created_by)
SELECT NULL, p.name, COALESCE(p.category, 'Geral'), true, NULL
FROM picked p
WHERE NOT EXISTS (
  SELECT 1 FROM public.property_amenities g
  WHERE g.organization_id IS NULL AND lower(g.name) = p.lname
);

-- 5) Catálogo global mínimo (caso a tabela esteja vazia)
INSERT INTO public.property_amenities (organization_id, name, category, is_default, created_by)
SELECT NULL, x.name, x.category, true, NULL
FROM (VALUES
  ('Piscina','Lazer'),
  ('Churrasqueira','Lazer'),
  ('Academia','Lazer'),
  ('Salão de Festas','Lazer'),
  ('Playground','Lazer'),
  ('Quadra Poliesportiva','Lazer'),
  ('Sauna','Lazer'),
  ('Portaria 24h','Segurança'),
  ('Câmeras de Segurança','Segurança'),
  ('Cerca Elétrica','Segurança'),
  ('Interfone','Segurança'),
  ('Elevador','Edificação'),
  ('Garagem Coberta','Edificação'),
  ('Área de Serviço','Edificação'),
  ('Varanda','Edificação'),
  ('Sacada','Edificação'),
  ('Vista para o Mar','Diferenciais'),
  ('Mobiliado','Diferenciais'),
  ('Ar Condicionado','Conforto'),
  ('Aquecimento Solar','Conforto'),
  ('Closet','Conforto'),
  ('Pet Friendly','Diferenciais')
) AS x(name, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.property_amenities g
  WHERE g.organization_id IS NULL AND lower(g.name) = lower(x.name)
);
