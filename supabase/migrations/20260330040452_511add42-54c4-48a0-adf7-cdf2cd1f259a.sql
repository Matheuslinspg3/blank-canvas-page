-- Fix: scope ticket-attachments storage policies to organization
DROP POLICY IF EXISTS "Users can upload ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view ticket attachments" ON storage.objects;

CREATE POLICY "Users can upload ticket attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
);

CREATE POLICY "Users can view ticket attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    (storage.foldername(name))[1] = public.get_user_organization_id()::text
    OR public.has_role(auth.uid(), 'developer')
  )
);