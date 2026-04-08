-- Add editor_mode column to distinguish simple vs advanced
ALTER TABLE site_documents
  ADD COLUMN editor_mode text NOT NULL DEFAULT 'simple'
  CHECK (editor_mode IN ('simple', 'advanced'));

-- Add v2 layout columns for advanced editor
ALTER TABLE site_documents
  ADD COLUMN draft_v2 jsonb,
  ADD COLUMN published_v2 jsonb;

-- Index for quick lookups by mode
CREATE INDEX idx_site_documents_mode ON site_documents(editor_mode);

-- Update public RPC to handle both modes
CREATE OR REPLACE FUNCTION public.get_public_site_document(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT CASE
    WHEN editor_mode = 'advanced' THEN published_v2
    ELSE published
  END
  FROM site_documents
  WHERE organization_id = p_org_id
  LIMIT 1;
$$;

-- New RPC returning editor_mode + layout for the public renderer
CREATE OR REPLACE FUNCTION public.get_public_site_document_full(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT jsonb_build_object(
    'editor_mode', editor_mode,
    'layout', CASE
      WHEN editor_mode = 'advanced' THEN published_v2
      ELSE published
    END
  )
  FROM site_documents
  WHERE organization_id = p_org_id
  LIMIT 1;
$$;