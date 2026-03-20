-- Enable each custom trigger individually on properties
ALTER TABLE public.properties ENABLE TRIGGER log_property_created;
ALTER TABLE public.properties ENABLE TRIGGER trg_audit_properties;
ALTER TABLE public.properties ENABLE TRIGGER trg_log_property_updated;
ALTER TABLE public.properties ENABLE TRIGGER trg_property_availability_change;
ALTER TABLE public.properties ENABLE TRIGGER trigger_auto_property_code;
ALTER TABLE public.properties ENABLE TRIGGER trigger_capture_media_before_delete;
ALTER TABLE public.properties ENABLE TRIGGER trigger_cascade_marketplace_delete;
ALTER TABLE public.properties ENABLE TRIGGER update_properties_updated_at;

-- Drop exec_sql function (security risk)
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- Add DELETE policy for property-images bucket
CREATE POLICY "Users can delete property images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'property-images');

-- Add UPDATE policy for property-images bucket
CREATE POLICY "Users can update property images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'property-images')
WITH CHECK (bucket_id = 'property-images');