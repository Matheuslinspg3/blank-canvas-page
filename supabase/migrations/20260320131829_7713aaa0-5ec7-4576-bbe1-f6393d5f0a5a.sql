
-- Disable audit triggers on leads and properties
ALTER TABLE leads DISABLE TRIGGER trg_audit_leads;
ALTER TABLE leads DISABLE TRIGGER trg_notify_broker_overload;
ALTER TABLE leads DISABLE TRIGGER trg_notify_unassigned_lead;
ALTER TABLE properties DISABLE TRIGGER trg_audit_properties;
ALTER TABLE properties DISABLE TRIGGER trigger_capture_media_before_delete;
ALTER TABLE properties DISABLE TRIGGER trigger_cascade_marketplace_delete;
