
-- marketplace_properties_public
CREATE OR REPLACE VIEW public.marketplace_properties_public
WITH (security_invoker = true) AS
SELECT id, title, description, property_type_id, transaction_type, sale_price, rent_price,
       sale_price_financed, payment_options, address_street, address_number, address_complement,
       address_neighborhood, address_city, address_state, address_zipcode, bedrooms, suites,
       bathrooms, parking_spots, area_total, area_built, amenities, images, status, is_featured,
       external_code, organization_id, marketplace_contact_phone, created_at, updated_at
FROM get_marketplace_properties_public();

-- vw_landing_links_without_contact
CREATE OR REPLACE VIEW public.vw_landing_links_without_contact
WITH (security_invoker = true) AS
SELECT sl.id AS share_link_id, sl.property_id, sl.broker_id, sl.broker_token,
       pr.full_name AS broker_name, pr.phone AS broker_phone,
       p.organization_id, o.name AS org_name
FROM property_share_links sl
LEFT JOIN profiles pr ON pr.user_id = sl.broker_id
LEFT JOIN properties p ON p.id = sl.property_id
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE sl.active = true AND (pr.phone IS NULL OR length(TRIM(BOTH FROM pr.phone)) = 0);

-- vw_marketplace_status_drift
CREATE OR REPLACE VIEW public.vw_marketplace_status_drift
WITH (security_invoker = true) AS
SELECT p.id AS property_id, p.organization_id, p.title,
       p.status AS property_status, mp.status AS marketplace_status,
       p.updated_at AS property_updated_at, mp.updated_at AS marketplace_updated_at
FROM properties p
JOIN marketplace_properties mp ON mp.id = p.id
WHERE p.updated_at > mp.updated_at OR p.status IS DISTINCT FROM mp.status OR p.title IS DISTINCT FROM mp.title;
