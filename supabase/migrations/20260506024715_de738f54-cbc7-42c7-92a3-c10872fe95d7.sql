-- Create a table for ad webhook logs
CREATE TABLE public.ad_webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'meta'
    external_lead_id TEXT,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received', -- 'received', 'processed', 'error'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own organization's ad webhook logs" 
ON public.ad_webhook_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.organization_id = ad_webhook_logs.organization_id
    )
);

-- Add index for performance
CREATE INDEX idx_ad_webhook_logs_org_id ON public.ad_webhook_logs(organization_id);
CREATE INDEX idx_ad_webhook_logs_lead_id ON public.ad_webhook_logs(external_lead_id);
CREATE INDEX idx_ad_webhook_logs_created_at ON public.ad_webhook_logs(created_at DESC);