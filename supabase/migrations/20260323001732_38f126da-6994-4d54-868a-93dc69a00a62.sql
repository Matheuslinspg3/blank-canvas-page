-- Performance Indexes & Marketplace Search Optimization

-- Dashboard KPI indexes (leads first index already created by prior attempt)
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON leads(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_active ON leads(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_leads_org_stage ON leads(organization_id, lead_stage_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_created ON contracts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_org_status ON contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_org_start ON appointments(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_broker_created ON lead_interactions(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_created ON lead_interactions(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_org_created ON transactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_org_status ON properties(organization_id, status);

-- Marketplace search (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_marketplace_city_trgm ON marketplace_properties USING GIN (address_city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_marketplace_properties_type_price ON marketplace_properties(transaction_type, sale_price);