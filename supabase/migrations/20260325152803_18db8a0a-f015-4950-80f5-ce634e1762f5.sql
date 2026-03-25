-- Add PDF template support columns to contract_templates
ALTER TABLE public.contract_templates 
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS field_positions jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contract_templates.template_type IS 'html = rich text editor, pdf = uploaded PDF with field positions';
COMMENT ON COLUMN public.contract_templates.pdf_url IS 'URL to the uploaded PDF file in storage';
COMMENT ON COLUMN public.contract_templates.field_positions IS 'Array of {id, variable, page, x, y, width, height, fontSize} objects for PDF field positioning';

-- Create storage bucket for contract template PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('contract-templates', 'contract-templates', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- RLS: org members can upload/read their own templates
CREATE POLICY "Org members can upload contract templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contract-templates' 
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);

CREATE POLICY "Org members can read contract templates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contract-templates'
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);

CREATE POLICY "Org members can delete contract templates"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contract-templates'
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);