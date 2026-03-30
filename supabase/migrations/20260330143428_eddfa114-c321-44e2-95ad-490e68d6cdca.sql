
-- 1. Fix website_settings: rename overly permissive anon policy
DROP POLICY IF EXISTS "Public can read active website settings" ON public.website_settings;
CREATE POLICY "Anon can read active website settings"
  ON public.website_settings
  FOR SELECT
  TO anon
  USING (is_active = true);

-- 2. Fix ai_properties_view: add security_invoker
DROP VIEW IF EXISTS public.ai_properties_view;
CREATE VIEW public.ai_properties_view
WITH (security_invoker = true, security_barrier = true)
AS SELECT 
  p.id,
  p.organization_id,
  p.property_code AS codigo,
  p.title AS titulo,
  p.description AS descricao,
  pt.name AS tipo_imovel,
  p.transaction_type AS tipo_transacao,
  p.sale_price AS preco_venda,
  p.rent_price AS preco_aluguel,
  p.bedrooms AS quartos,
  p.suites,
  p.bathrooms AS banheiros,
  p.parking_spots AS vagas,
  p.area_total,
  p.area_useful AS area_util,
  p.address_neighborhood AS bairro,
  p.address_city AS cidade,
  p.address_street AS rua,
  p.address_number AS numero,
  p.address_complement AS complemento,
  p.address_state AS estado,
  p.condominium_fee AS condominio,
  p.iptu_monthly AS iptu_mensal,
  p.amenities AS comodidades,
  p.property_condition AS condicao,
  p.launch_stage AS fase_lancamento,
  p.development_name AS empreendimento,
  p.beach_distance_meters AS distancia_praia_metros,
  p.payment_options AS opcoes_pagamento,
  p.youtube_url AS video_url,
  p.availability_status AS disponibilidade,
  p.status,
  p.featured AS destaque,
  p.ai_blacklist,
  p.updated_at
FROM properties p
LEFT JOIN property_types pt ON pt.id = p.property_type_id
WHERE p.ai_blacklist = false AND p.availability_status = 'available';

-- 3. Fix marketplace_properties_public: add security_invoker
DROP VIEW IF EXISTS public.marketplace_properties_public;
CREATE VIEW public.marketplace_properties_public
WITH (security_invoker = true, security_barrier = true)
AS SELECT
  id, title, description, property_type_id, transaction_type,
  sale_price, rent_price, sale_price_financed, payment_options,
  address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, address_zipcode,
  bedrooms, suites, bathrooms, parking_spots,
  area_total, area_built, amenities, images,
  status, is_featured, external_code,
  organization_id, created_at, updated_at
FROM get_marketplace_properties_public();

-- 4. Fix function search_path on AI functions
CREATE OR REPLACE FUNCTION public.ai_buscar_imoveis(
  org_id uuid, tipo_imovel text DEFAULT NULL, bairro text DEFAULT NULL,
  transacao text DEFAULT NULL, preco_min numeric DEFAULT NULL, preco_max numeric DEFAULT NULL,
  quartos_min integer DEFAULT NULL, vagas_min integer DEFAULT NULL,
  area_min numeric DEFAULT NULL, limite integer DEFAULT 20
) RETURNS json LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT json_agg(row_to_json(r)) FROM (
    SELECT p.id, p.property_code, p.title, pt.name as tipo_imovel,
      p.transaction_type, p.sale_price, p.rent_price,
      p.bedrooms, p.suites, p.bathrooms, p.parking_spots,
      p.area_total, p.area_useful,
      p.address_neighborhood as bairro, p.address_city as cidade,
      p.condominium_fee, p.iptu_monthly, p.amenities, p.property_condition,
      p.launch_stage, p.development_name, p.beach_distance_meters
    FROM properties p LEFT JOIN property_types pt ON pt.id = p.property_type_id
    WHERE p.organization_id = org_id AND p.ai_blacklist = false AND p.availability_status = 'available'
    AND (tipo_imovel IS NULL OR pt.name ILIKE '%' || tipo_imovel || '%')
    AND (bairro IS NULL OR p.address_neighborhood ILIKE '%' || bairro || '%')
    AND (transacao IS NULL OR p.transaction_type::text = transacao)
    AND (preco_min IS NULL OR COALESCE(p.sale_price, p.rent_price, 0) >= preco_min)
    AND (preco_max IS NULL OR COALESCE(p.sale_price, p.rent_price, 0) <= preco_max)
    AND (quartos_min IS NULL OR p.bedrooms >= quartos_min)
    AND (vagas_min IS NULL OR p.parking_spots >= vagas_min)
    AND (area_min IS NULL OR COALESCE(p.area_useful, p.area_total, 0) >= area_min)
    ORDER BY p.featured DESC, p.updated_at DESC LIMIT limite
  ) r;
$$;

CREATE OR REPLACE FUNCTION public.ai_buscar_por_codigo(org_id uuid, codigo text)
RETURNS json LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT json_agg(row_to_json(r)) FROM (
    SELECT p.id, p.property_code, p.title, p.description, pt.name as tipo_imovel,
      p.transaction_type, p.sale_price, p.rent_price,
      p.bedrooms, p.suites, p.bathrooms, p.parking_spots, p.area_total, p.area_useful,
      p.address_neighborhood as bairro, p.address_city as cidade,
      p.address_street as rua, p.address_number as numero,
      p.condominium_fee, p.iptu, p.iptu_monthly, p.amenities, p.property_condition,
      p.launch_stage, p.development_name, p.beach_distance_meters,
      p.availability_status, p.status, p.youtube_url
    FROM properties p LEFT JOIN property_types pt ON pt.id = p.property_type_id
    WHERE p.organization_id = org_id AND p.property_code ILIKE '%' || codigo || '%'
    AND p.ai_blacklist = false AND p.availability_status = 'available' LIMIT 5
  ) r;
$$;

CREATE OR REPLACE FUNCTION public.ai_detalhes_imovel(org_id uuid, imovel_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT json_build_object(
    'imovel', (SELECT row_to_json(r) FROM (
      SELECT p.id, p.property_code, p.title, p.description, pt.name as tipo_imovel,
        p.transaction_type, p.sale_price, p.rent_price,
        p.bedrooms, p.suites, p.bathrooms, p.parking_spots,
        p.area_total, p.area_useful, p.area_built,
        p.address_street as rua, p.address_number as numero,
        p.address_complement as complemento,
        p.address_neighborhood as bairro, p.address_city as cidade,
        p.address_state as estado, p.address_zipcode as cep,
        p.condominium_fee, p.iptu, p.iptu_monthly, p.amenities, p.property_condition,
        p.launch_stage, p.development_name, p.beach_distance_meters,
        p.payment_options, p.youtube_url, p.availability_status, p.status
      FROM properties p LEFT JOIN property_types pt ON pt.id = p.property_type_id
      WHERE p.id = imovel_id AND p.organization_id = org_id
    ) r),
    'fotos', (SELECT json_agg(json_build_object('url', pi.url, 'is_cover', pi.is_cover, 'tipo', pi.image_type)
      ORDER BY pi.is_cover DESC, pi.display_order)
      FROM property_images pi WHERE pi.property_id = imovel_id LIMIT 10)
  );
$$;

CREATE OR REPLACE FUNCTION public.ai_listar_opcoes(org_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT json_build_object(
    'tipos_imovel', (SELECT json_agg(DISTINCT pt.name ORDER BY pt.name)
      FROM properties p JOIN property_types pt ON pt.id = p.property_type_id
      WHERE p.organization_id = org_id AND p.availability_status = 'available' AND p.ai_blacklist = false),
    'bairros', (SELECT json_agg(DISTINCT initcap(trim(p.address_neighborhood)) ORDER BY initcap(trim(p.address_neighborhood)))
      FROM properties p WHERE p.organization_id = org_id AND p.address_neighborhood IS NOT NULL
      AND trim(p.address_neighborhood) != '' AND p.availability_status = 'available' AND p.ai_blacklist = false),
    'faixa_precos', (SELECT json_build_object(
        'venda_min', min(p.sale_price) FILTER (WHERE p.sale_price > 0),
        'venda_max', max(p.sale_price) FILTER (WHERE p.sale_price > 0),
        'aluguel_min', min(p.rent_price) FILTER (WHERE p.rent_price > 0),
        'aluguel_max', max(p.rent_price) FILTER (WHERE p.rent_price > 0))
      FROM properties p WHERE p.organization_id = org_id AND p.availability_status = 'available' AND p.ai_blacklist = false),
    'total_disponiveis', (SELECT count(*) FROM properties p
      WHERE p.organization_id = org_id AND p.availability_status = 'available' AND p.ai_blacklist = false)
  );
$$;
