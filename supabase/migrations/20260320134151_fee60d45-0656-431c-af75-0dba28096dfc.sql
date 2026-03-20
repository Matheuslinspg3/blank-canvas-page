-- BLOCO 1: Dependências de leads órfãos
DELETE FROM lead_score_events WHERE lead_id IN (
  SELECT id FROM leads WHERE organization_id IN (
    'fd75cd4a-5321-481d-a34b-87ee879e775c',
    '11604e91-836f-4d52-baa5-2444c5281673',
    '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
    '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
  )
);

DELETE FROM lead_interactions WHERE lead_id IN (
  SELECT id FROM leads WHERE organization_id IN (
    'fd75cd4a-5321-481d-a34b-87ee879e775c',
    '11604e91-836f-4d52-baa5-2444c5281673',
    '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
    '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
  )
);

DELETE FROM appointments WHERE lead_id IN (
  SELECT id FROM leads WHERE organization_id IN (
    'fd75cd4a-5321-481d-a34b-87ee879e775c',
    '11604e91-836f-4d52-baa5-2444c5281673',
    '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
    '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
  )
);

-- BLOCO 2: Dependências de properties órfãs
DELETE FROM property_images WHERE property_id IN (
  SELECT id FROM properties WHERE organization_id IN (
    'fd75cd4a-5321-481d-a34b-87ee879e775c',
    '11604e91-836f-4d52-baa5-2444c5281673',
    '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
    '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
  )
);

DELETE FROM property_owners WHERE property_id IN (
  SELECT id FROM properties WHERE organization_id IN (
    'fd75cd4a-5321-481d-a34b-87ee879e775c',
    '11604e91-836f-4d52-baa5-2444c5281673',
    '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
    '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
  )
);

-- BLOCO 3: Logs e notificações das orgs órfãs
DELETE FROM notifications WHERE organization_id IN (
  'fd75cd4a-5321-481d-a34b-87ee879e775c',
  '11604e91-836f-4d52-baa5-2444c5281673',
  '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
  '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
);

DELETE FROM activity_log WHERE organization_id IN (
  'fd75cd4a-5321-481d-a34b-87ee879e775c',
  '11604e91-836f-4d52-baa5-2444c5281673',
  '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
  '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
);

DELETE FROM audit_events WHERE organization_id IN (
  'fd75cd4a-5321-481d-a34b-87ee879e775c',
  '11604e91-836f-4d52-baa5-2444c5281673',
  '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
  '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
);

-- BLOCO 4: Leads e properties duplicados
DELETE FROM leads WHERE organization_id IN (
  'fd75cd4a-5321-481d-a34b-87ee879e775c',
  '11604e91-836f-4d52-baa5-2444c5281673',
  '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
  '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
);

DELETE FROM properties WHERE organization_id IN (
  'fd75cd4a-5321-481d-a34b-87ee879e775c',
  '11604e91-836f-4d52-baa5-2444c5281673',
  '14005d35-56b0-4b77-89bf-d7bdd56cb55f',
  '8ac78cbc-840a-43aa-b41b-fcd7e9a36f37'
);

-- BLOCO 5: Imagens órfãs (property não existe)
DELETE FROM property_images 
WHERE NOT EXISTS (
  SELECT 1 FROM properties p WHERE p.id = property_images.property_id
);

-- BLOCO 6: Reabilitar triggers
ALTER TABLE leads ENABLE TRIGGER trg_audit_leads;
ALTER TABLE leads ENABLE TRIGGER trg_notify_broker_overload;
ALTER TABLE leads ENABLE TRIGGER trg_notify_unassigned_lead;
ALTER TABLE properties ENABLE TRIGGER trg_audit_properties;
ALTER TABLE properties ENABLE TRIGGER trigger_capture_media_before_delete;
ALTER TABLE properties ENABLE TRIGGER trigger_cascade_marketplace_delete;