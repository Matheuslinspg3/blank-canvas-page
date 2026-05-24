-- Create WhatsApp connections table
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'evolution_go',
    provider_instance_id TEXT,
    instance_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_configured',
    phone_number TEXT,
    qr_code TEXT,
    pairing_code TEXT,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    last_error_code TEXT,
    last_error_message TEXT,
    last_debug_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id)
);

-- Create WhatsApp connection events table for auditing
CREATE TABLE IF NOT EXISTS public.whatsapp_connection_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    status_before TEXT,
    status_after TEXT,
    provider TEXT,
    debug_ref TEXT,
    metadata_sanitized JSONB DEFAULT '{}'::jsonb,
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connection_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_connections
CREATE POLICY "Users can view their organization's WhatsApp connection"
    ON public.whatsapp_connections FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- RLS Policies for whatsapp_connection_events
CREATE POLICY "Users can view their organization's WhatsApp connection events"
    ON public.whatsapp_connection_events FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_whatsapp_connections_updated_at
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_whatsapp_connections_updated_at();

-- Add index
CREATE INDEX idx_whatsapp_connections_org_id ON public.whatsapp_connections(organization_id);
CREATE INDEX idx_whatsapp_connection_events_org_id ON public.whatsapp_connection_events(organization_id);
