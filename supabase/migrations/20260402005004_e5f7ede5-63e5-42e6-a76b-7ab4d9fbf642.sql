
ALTER TABLE public.ai_qualification_config
  ADD COLUMN IF NOT EXISTS auto_scoring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_criteria JSONB NOT NULL DEFAULT '[
    {"key":"responded_24h","label":"Respondeu em menos de 24h","weight":10,"enabled":true},
    {"key":"informed_budget","label":"Informou orçamento/renda","weight":20,"enabled":true},
    {"key":"informed_region","label":"Informou região de interesse","weight":15,"enabled":true},
    {"key":"financing_simulation","label":"Pediu simulação de financiamento","weight":20,"enabled":true},
    {"key":"scheduled_visit","label":"Agendou visita","weight":25,"enabled":true},
    {"key":"paid_campaign","label":"Origem: campanha paga","weight":10,"enabled":true}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS temperature_thresholds JSONB NOT NULL DEFAULT '{"cold_max":30,"warm_max":69}'::jsonb;
