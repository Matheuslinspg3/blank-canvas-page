-- Step 1: Copy owners from source org to Porto Caiçara (deduplicate by phone)
INSERT INTO owners (primary_name, phone, email, document, notes, organization_id)
SELECT o.primary_name, o.phone, o.email, o.document, o.notes, 'cdf3f0e6-da64-4090-bc76-1758796bea28'
FROM owners o
WHERE o.organization_id = 'fd75cd4a-5321-481d-a34b-87ee879e775c'
  AND NOT EXISTS (
    SELECT 1 FROM owners d 
    WHERE d.organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28' 
      AND d.phone = o.phone
  );

-- Step 2: Copy property_owners, remapping property_id via source_property_id and owner_id via phone
INSERT INTO property_owners (property_id, organization_id, owner_id, name, phone, email, document, notes, is_primary)
SELECT 
  p_dest.id,
  'cdf3f0e6-da64-4090-bc76-1758796bea28',
  dest_owner.id,
  po.name,
  po.phone,
  po.email,
  po.document,
  po.notes,
  COALESCE(po.is_primary, true)
FROM property_owners po
JOIN properties p_dest ON p_dest.source_property_id = po.property_id::text 
  AND p_dest.organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28'
LEFT JOIN owners src_owner ON src_owner.id = po.owner_id 
  AND src_owner.organization_id = 'fd75cd4a-5321-481d-a34b-87ee879e775c'
LEFT JOIN owners dest_owner ON dest_owner.phone = src_owner.phone 
  AND dest_owner.organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28'
WHERE po.organization_id = 'fd75cd4a-5321-481d-a34b-87ee879e775c'
  AND NOT EXISTS (
    SELECT 1 FROM property_owners existing 
    WHERE existing.property_id = p_dest.id 
      AND existing.organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28'
  );

-- Step 3: Copy owner_aliases
INSERT INTO owner_aliases (owner_id, name, occurrence_count)
SELECT 
  dest_owner.id,
  sa.name,
  sa.occurrence_count
FROM owner_aliases sa
JOIN owners src_owner ON src_owner.id = sa.owner_id 
  AND src_owner.organization_id = 'fd75cd4a-5321-481d-a34b-87ee879e775c'
JOIN owners dest_owner ON dest_owner.phone = src_owner.phone 
  AND dest_owner.organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28'
WHERE NOT EXISTS (
  SELECT 1 FROM owner_aliases ea 
  WHERE ea.owner_id = dest_owner.id AND ea.name = sa.name
);