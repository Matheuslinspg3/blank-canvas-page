CREATE TABLE IF NOT EXISTS public.pdf_extract_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
  file_name text,
  result jsonb,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pdf_extract_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org jobs" ON public.pdf_extract_jobs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_pdf_extract_jobs_status ON public.pdf_extract_jobs(user_id, status);