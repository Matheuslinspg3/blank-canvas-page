
-- Tabela para mapear domínios customizados → organizações
CREATE TABLE public.tenant_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  cloudflare_hostname_id TEXT,
  ssl_status TEXT NOT NULL DEFAULT 'pending',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT tenant_domains_hostname_unique UNIQUE (hostname)
);

-- Index para lookup rápido por hostname (usado em cada request)
CREATE INDEX idx_tenant_domains_hostname ON public.tenant_domains (hostname) WHERE is_active = true;

-- RLS
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- Managers+ podem ver domínios da própria org
CREATE POLICY "Managers can view org domains"
  ON public.tenant_domains FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Managers+ podem inserir domínios
CREATE POLICY "Managers can insert org domains"
  ON public.tenant_domains FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Managers+ podem atualizar domínios da própria org
CREATE POLICY "Managers can update org domains"
  ON public.tenant_domains FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Managers+ podem deletar domínios da própria org
CREATE POLICY "Managers can delete org domains"
  ON public.tenant_domains FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Leitura pública por hostname (necessário pro roteamento anônimo)
CREATE POLICY "Public can read active domains by hostname"
  ON public.tenant_domains FOR SELECT
  TO anon
  USING (is_active = true);
