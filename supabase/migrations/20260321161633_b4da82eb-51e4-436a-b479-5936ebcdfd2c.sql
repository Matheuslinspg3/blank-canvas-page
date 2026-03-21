BEGIN;

-- property-images bucket: Fix DELETE and UPDATE to check org
-- Since the bucket is unused (images on Cloudinary/R2), use path-based org isolation
-- Path convention: {org_id}/{property_id}/{filename}

DROP POLICY IF EXISTS "Users can delete property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;

CREATE POLICY "Users can delete property images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = (get_user_organization_id())::text
  );

CREATE POLICY "Users can update property images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = (get_user_organization_id())::text
  ) WITH CHECK (
    bucket_id = 'property-images'
  );

CREATE POLICY "Users can upload property images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = (get_user_organization_id())::text
  );

COMMIT;