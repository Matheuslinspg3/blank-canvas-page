INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('temp-uploads', 'temp-uploads', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload temp PDFs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'temp-uploads');

CREATE POLICY "Authenticated users can read own temp uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'temp-uploads');

CREATE POLICY "Service role can manage temp uploads"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'temp-uploads');