-- Hardening: lead-documents storage policies com isolamento por organização via path
-- Paths seguem padrão: {org_id}/{lead_id}/{filename}

DROP POLICY IF EXISTS "Org members can view lead docs" ON storage.objects;
CREATE POLICY "Org members can view lead docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lead-documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "Org members can upload lead docs" ON storage.objects;
CREATE POLICY "Org members can upload lead docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lead-documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "Org members can update lead docs" ON storage.objects;
CREATE POLICY "Org members can update lead docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lead-documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "Admins can delete lead docs" ON storage.objects;
CREATE POLICY "Admins can delete lead docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'lead-documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );