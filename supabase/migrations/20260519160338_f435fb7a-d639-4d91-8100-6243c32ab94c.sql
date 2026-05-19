-- Add attribution context to core tables
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS attribution_context JSONB DEFAULT '{}';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS attribution_context JSONB DEFAULT '{}';

-- Create table for tracking payment attempts (leads hot)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES public.organizations(id),
    plan_id UUID REFERENCES public.subscription_plans(id),
    amount_cents INTEGER,
    billing_cycle TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'initiated', -- initiated, completed, failed
    attribution_context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for payment_attempts
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own payment attempts"
    ON public.payment_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own payment attempts"
    ON public.payment_attempts FOR SELECT
    USING (auth.uid() = user_id);

-- Create index for faster lookups in admin panel
CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id ON public.payment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_org_id ON public.payment_attempts(organization_id);
