
-- ============================================================
-- FASE H1 — Seed realista para 3 orgs de teste
-- ============================================================

-- === ORG 1: Vitrine Premium Imóveis (alto padrão) ===
INSERT INTO organizations (id, name, slug)
VALUES ('a1b2c3d4-1111-4000-8000-000000000001', 'Vitrine Premium Imóveis', 'vitrine-premium')
ON CONFLICT (id) DO NOTHING;

INSERT INTO brand_settings (organization_id, primary_color, secondary_color, accent_color, font_family, tagline, slogan)
VALUES ('a1b2c3d4-1111-4000-8000-000000000001', '#0F172A', '#D4AF37', '#E11D48', 'Playfair Display', 'Exclusividade que inspira', 'Imóveis de alto padrão no litoral paulista')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO website_settings (organization_id, hero_title, hero_subtitle, about_text, contact_email, contact_phone, whatsapp_number, whatsapp_message, show_whatsapp_float, meta_title, meta_description, site_template, is_active)
VALUES ('a1b2c3d4-1111-4000-8000-000000000001',
  'Imóveis de Alto Padrão no Litoral Paulista',
  'Apartamentos frente-mar, coberturas exclusivas e casas em condomínios fechados nas melhores praias de São Paulo.',
  'A Vitrine Premium atua há mais de 15 anos no mercado imobiliário de alto padrão do litoral paulista. Somos especializados em imóveis exclusivos em Guarujá, Santos, Riviera de São Lourenço e Bertioga. Nossa equipe de consultores oferece atendimento personalizado, do primeiro contato à entrega das chaves, garantindo uma experiência diferenciada para quem busca qualidade de vida junto ao mar.',
  'contato@vitrinepremium.com.br', '(13) 3322-4455', '5513991234567',
  'Olá! Gostaria de conhecer os imóveis disponíveis na Vitrine Premium.',
  true,
  'Vitrine Premium Imóveis — Alto Padrão no Litoral Paulista',
  'Encontre apartamentos, coberturas e casas de alto padrão em Guarujá, Santos e Riviera. Atendimento exclusivo e imóveis selecionados.',
  'elegant', true)
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO marketplace_properties (organization_id, title, description, transaction_type, sale_price, address_neighborhood, address_city, address_state, bedrooms, suites, bathrooms, parking_spots, area_total, area_built, amenities, images, status, is_featured) VALUES
('a1b2c3d4-1111-4000-8000-000000000001', 'Cobertura Duplex Frente-Mar — Pitangueiras', 'Cobertura duplex com vista panorâmica para o mar. Terraço gourmet, piscina privativa e sauna. Acabamento em mármore italiano e automação residencial completa.', 'venda', 4800000, 'Pitangueiras', 'Guarujá', 'SP', 5, 4, 6, 4, 420, 380, ARRAY['Piscina privativa','Sauna','Terraço gourmet','Automação','Vista mar'], ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800','https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'], 'disponivel', true),
('a1b2c3d4-1111-4000-8000-000000000001', 'Apartamento 4 Suítes — Astúrias', 'Apartamento alto padrão com 4 suítes, living amplo com lareira, varanda gourmet com churrasqueira e vista lateral para o mar.', 'venda', 2200000, 'Astúrias', 'Guarujá', 'SP', 4, 4, 5, 3, 280, 260, ARRAY['Piscina','Academia','Salão de festas'], ARRAY['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800','https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800'], 'disponivel', true),
('a1b2c3d4-1111-4000-8000-000000000001', 'Casa em Condomínio — Riviera de São Lourenço', 'Casa térrea em condomínio fechado na Riviera. Arquitetura contemporânea com pé-direito duplo, piscina com borda infinita e jardim tropical.', 'venda', 3500000, 'Riviera de São Lourenço', 'Bertioga', 'SP', 5, 5, 6, 4, 600, 450, ARRAY['Piscina','Jardim','Churrasqueira','Home theater','Condomínio fechado'], ARRAY['https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800','https://images.unsplash.com/photo-1600566753190-17f0baa2a6c0?w=800'], 'disponivel', true),
('a1b2c3d4-1111-4000-8000-000000000001', 'Penthouse com Rooftop — Gonzaga', 'Penthouse exclusiva com rooftop privativo de 120m². Vista 360° da cidade e do mar. Acabamento premium.', 'venda', 5200000, 'Gonzaga', 'Santos', 'SP', 4, 4, 5, 4, 350, 320, ARRAY['Rooftop privativo','Vista 360°','Automação'], ARRAY['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'], 'disponivel', true),
('a1b2c3d4-1111-4000-8000-000000000001', 'Apartamento Garden — Enseada', 'Garden com 180m² de área privativa e quintal com deck de madeira. 3 suítes com armários planejados.', 'venda', 1800000, 'Enseada', 'Guarujá', 'SP', 3, 3, 4, 2, 250, 180, ARRAY['Piscina','Quadra','Playground'], ARRAY['https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Studio de Luxo — Boqueirão', 'Studio compacto e sofisticado com vista mar. Mobília assinada, cozinha gourmet integrada.', 'venda', 850000, 'Boqueirão', 'Santos', 'SP', 1, 1, 1, 1, 55, 50, ARRAY['Piscina','Rooftop','Coworking'], ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Apartamento 3 Suítes — Ponta da Praia', 'Apartamento reformado com projeto de interiores. 3 suítes amplas, living com ilha gourmet.', 'venda', 1450000, 'Ponta da Praia', 'Santos', 'SP', 3, 3, 4, 2, 180, 170, ARRAY['Piscina','Salão gourmet'], ARRAY['https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Casa Contemporânea — Acapulco', 'Casa nova em condomínio Acapulco com 4 suítes, piscina aquecida, espaço gourmet com forno de pizza.', 'venda', 4200000, 'Acapulco', 'Guarujá', 'SP', 4, 4, 5, 4, 550, 400, ARRAY['Piscina aquecida','Adega','Forno de pizza','Condomínio fechado'], ARRAY['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Flat Decorado — Gonzaga', 'Flat totalmente decorado em edifício com serviços. Pool de locação disponível.', 'venda', 780000, 'Gonzaga', 'Santos', 'SP', 1, 1, 2, 1, 65, 60, ARRAY['Room service','Lavanderia','Piscina'], ARRAY['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Apartamento Alto Padrão — Pompéia', 'Apartamento novo com acabamento diferenciado. 3 suítes, varanda gourmet, depósito privativo.', 'venda', 1650000, 'Pompéia', 'Santos', 'SP', 3, 3, 4, 3, 200, 185, ARRAY['Piscina','Spa','Cinema','Pet place'], ARRAY['https://images.unsplash.com/photo-1600573472556-e636c2acda9e?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Cobertura Linear — Tombo', 'Cobertura linear com 3 suítes e terraço com piscina. Vista mar frontal.', 'venda', 2800000, 'Tombo', 'Guarujá', 'SP', 3, 3, 4, 3, 300, 270, ARRAY['Piscina no terraço','Vista mar','Churrasqueira'], ARRAY['https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=800'], 'disponivel', false),
('a1b2c3d4-1111-4000-8000-000000000001', 'Casa Térrea — Morada da Praia', 'Casa térrea em condomínio com segurança 24h. 3 suítes, piscina e edícula. Terreno de 450m².', 'venda', 1950000, 'Morada da Praia', 'Bertioga', 'SP', 3, 3, 4, 2, 450, 280, ARRAY['Piscina','Edícula','Condomínio fechado','Segurança 24h'], ARRAY['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'], 'disponivel', false);

-- === ORG 2: Nova Casa Imobiliária (médio padrão) ===
INSERT INTO organizations (id, name, slug)
VALUES ('a1b2c3d4-2222-4000-8000-000000000002', 'Nova Casa Imobiliária', 'nova-casa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO brand_settings (organization_id, primary_color, secondary_color, accent_color, font_family)
VALUES ('a1b2c3d4-2222-4000-8000-000000000002', '#2563EB', '#1E293B', '#F97316', 'Inter')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO website_settings (organization_id, hero_title, hero_subtitle, about_text, whatsapp_number, whatsapp_message, contact_phone, show_whatsapp_float, meta_title, site_template, is_active)
VALUES ('a1b2c3d4-2222-4000-8000-000000000002',
  'Seu novo lar está aqui',
  'Apartamentos e casas em Campinas e região com as melhores condições do mercado.',
  'A Nova Casa Imobiliária é referência em imóveis residenciais na região de Campinas. Trabalhamos com transparência e agilidade para encontrar o imóvel ideal para sua família.',
  '5519998765432', 'Olá, vi um imóvel no site e gostaria de mais informações!',
  '(19) 3255-8800', true,
  'Nova Casa Imobiliária — Imóveis em Campinas e Região',
  'modern', true)
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO marketplace_properties (organization_id, title, description, transaction_type, sale_price, address_neighborhood, address_city, address_state, bedrooms, suites, bathrooms, parking_spots, area_total, area_built, amenities, images, status, is_featured) VALUES
('a1b2c3d4-2222-4000-8000-000000000002', 'Apartamento 2 Quartos — Taquaral', 'Apartamento reformado próximo à Lagoa do Taquaral. 2 quartos, sala ampla e cozinha americana.', 'venda', 380000, 'Taquaral', 'Campinas', 'SP', 2, 0, 1, 1, 68, 62, ARRAY['Piscina','Churrasqueira','Playground'], ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'], 'disponivel', true),
('a1b2c3d4-2222-4000-8000-000000000002', 'Casa 3 Quartos — Barão Geraldo', 'Casa em rua tranquila com 3 quartos, quintal e edícula. Próxima à Unicamp.', 'venda', 520000, 'Barão Geraldo', 'Campinas', 'SP', 3, 1, 2, 2, 200, 140, ARRAY['Quintal','Edícula'], ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'], 'disponivel', true),
('a1b2c3d4-2222-4000-8000-000000000002', 'Apartamento 3 Quartos — Cambuí', 'Apartamento bem localizado no Cambuí. 3 quartos sendo 1 suíte, varanda e 2 vagas.', 'venda', 650000, 'Cambuí', 'Campinas', 'SP', 3, 1, 2, 2, 95, 90, ARRAY['Piscina','Academia','Salão de festas'], ARRAY['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'], 'disponivel', false),
('a1b2c3d4-2222-4000-8000-000000000002', 'Casa em Condomínio — Jundiaí', 'Casa nova em condomínio fechado. 3 suítes, cozinha planejada e área gourmet.', 'venda', 750000, 'Engordadouro', 'Jundiaí', 'SP', 3, 3, 3, 2, 300, 180, ARRAY['Piscina','Segurança 24h','Área gourmet'], ARRAY['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'], 'disponivel', false),
('a1b2c3d4-2222-4000-8000-000000000002', 'Kitnet Mobiliada — Centro', 'Kitnet mobiliada no centro de Campinas. Ideal para estudantes.', 'aluguel', NULL, 'Centro', 'Campinas', 'SP', 1, 0, 1, 0, 30, 28, NULL, ARRAY['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'], 'disponivel', false),
('a1b2c3d4-2222-4000-8000-000000000002', 'Sobrado 4 Quartos — Sousas', 'Sobrado espaçoso em bairro nobre. 4 quartos, piscina, churrasqueira e jardim.', 'venda', 890000, 'Sousas', 'Campinas', 'SP', 4, 2, 3, 3, 400, 280, ARRAY['Piscina','Churrasqueira','Jardim','Vista serra'], ARRAY['https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800'], 'disponivel', false);

-- Set rent_price for the kitnet
UPDATE marketplace_properties SET rent_price = 1200 WHERE organization_id = 'a1b2c3d4-2222-4000-8000-000000000002' AND title LIKE '%Kitnet%';

-- === ORG 3: JR Corretor (edge case) ===
INSERT INTO organizations (id, name, slug)
VALUES ('a1b2c3d4-3333-4000-8000-000000000003', 'JR Corretor', 'jr-corretor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO brand_settings (organization_id, primary_color, secondary_color, accent_color)
VALUES ('a1b2c3d4-3333-4000-8000-000000000003', '#3B82F6', '#1E293B', '#F59E0B')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO website_settings (organization_id, hero_title, site_template, is_active)
VALUES ('a1b2c3d4-3333-4000-8000-000000000003',
  'JR Corretor — Imóveis em Sorocaba',
  'classic', true)
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO marketplace_properties (organization_id, title, description, transaction_type, sale_price, address_neighborhood, address_city, address_state, bedrooms, bathrooms, parking_spots, area_built, images, status, is_featured) VALUES
('a1b2c3d4-3333-4000-8000-000000000003', 'Apartamento 2 Quartos — Wanel Ville', 'Apartamento com 2 quartos, sala e cozinha. Condomínio com portaria.', 'venda', 280000, 'Wanel Ville', 'Sorocaba', 'SP', 2, 1, 1, 55, ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'], 'disponivel', false),
('a1b2c3d4-3333-4000-8000-000000000003', 'Casa Simples — Éden', 'Casa com 2 quartos e quintal. Rua asfaltada, próxima a escola.', 'venda', 220000, 'Éden', 'Sorocaba', 'SP', 2, 1, 1, 70, ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'], 'disponivel', true);
