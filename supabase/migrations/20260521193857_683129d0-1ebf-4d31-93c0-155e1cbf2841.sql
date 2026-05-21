-- Create meta_lead_failures table
CREATE TABLE IF NOT EXISTS public.meta_lead_failures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'meta',
    leadgen_id TEXT NOT NULL,
    page_id TEXT,
    form_id TEXT,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, retrying, failed, resolved, error
    reason TEXT,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(provider, leadgen_id)
);

-- Enable Row Level Security
ALTER TABLE public.meta_lead_failures ENABLE ROW LEVEL SECURITY;

-- Policies (Admin/Developer only via user_roles table)
CREATE POLICY "Admins and developers can view failures"
ON public.meta_lead_failures
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND (user_roles.role::text = 'admin' OR user_roles.role::text = 'developer')
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_meta_lead_failures_updated_at
BEFORE UPDATE ON public.meta_lead_failures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
