-- Create isolated bucket for WhatsApp media (audios, images, videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  10485760,  -- 10MB limit
  ARRAY['audio/ogg', 'audio/mpeg', 'audio/webm', 'audio/mp4', 'audio/amr', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4']
) ON CONFLICT (id) DO NOTHING;

-- RLS: service role inserts (edge functions), authenticated reads by org
CREATE POLICY "Authenticated users can read their org media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Public read (bucket is public, so anyone with URL can access)
CREATE POLICY "Public read for whatsapp media"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'whatsapp-media');

-- Service role can insert/delete (edge functions use service key)
CREATE POLICY "Service role manages whatsapp media"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');

-- Function to clean up old whatsapp media (>30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_whatsapp_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'whatsapp-media'
    AND created_at < now() - interval '30 days';
END;
$$;

-- Schedule via pg_cron if available (will silently fail if not)
DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-whatsapp-media',
    '0 3 * * *',
    'SELECT public.cleanup_old_whatsapp_media()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skip scheduling';
END;
$$;