
-- Table: site_documents
CREATE TABLE public.site_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft jsonb NOT NULL DEFAULT '{"version":1,"blocks":[],"theme":{},"meta":{}}'::jsonb,
  published jsonb,
  last_published_at timestamptz,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX idx_site_documents_org ON public.site_documents(organization_id);

-- RLS
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage own site_documents"
ON public.site_documents
FOR ALL
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Anon can read published site_documents"
ON public.site_documents
FOR SELECT
TO anon
USING (published IS NOT NULL);

-- RPC: get_public_site_document
CREATE OR REPLACE FUNCTION public.get_public_site_document(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT published
  FROM public.site_documents
  WHERE organization_id = p_org_id
    AND published IS NOT NULL
  LIMIT 1;
$$;
