CREATE TABLE public.simulacoes_financiamento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  imovel_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  valor_imovel NUMERIC NOT NULL,
  valor_entrada NUMERIC NOT NULL,
  valor_fgts NUMERIC DEFAULT 0,
  valor_financiado NUMERIC NOT NULL,
  prazo_meses INTEGER NOT NULL,
  idade_comprador INTEGER NOT NULL,
  renda_mensal NUMERIC NOT NULL,
  sistema_amortizacao TEXT NOT NULL,
  banco_id TEXT NOT NULL,
  taxa_anual NUMERIC NOT NULL,
  tr_mensal NUMERIC NOT NULL,
  primeira_parcela NUMERIC NOT NULL,
  ultima_parcela NUMERIC NOT NULL,
  total_pago NUMERIC NOT NULL,
  total_juros NUMERIC NOT NULL,
  total_seguros NUMERIC NOT NULL,
  cet_anual_estimado NUMERIC NOT NULL,
  comprometimento_renda NUMERIC NOT NULL,
  aprovado BOOLEAN NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.simulacoes_financiamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own simulations"
  ON public.simulacoes_financiamento FOR ALL
  USING (auth.uid() = corretor_id);

CREATE POLICY "Org members can view simulations"
  ON public.simulacoes_financiamento FOR SELECT
  USING (organization_id = (SELECT public.get_user_organization_id()));