ALTER TABLE public.whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS prompt_qualify_leads text 
    DEFAULT 'Você deve qualificar cada lead coletando: nome completo, telefone, e-mail, tipo de imóvel desejado, faixa de preço e bairros de interesse. Classifique como FRIO, MORNO ou QUENTE.',
  ADD COLUMN IF NOT EXISTS prompt_create_leads text 
    DEFAULT 'Quando identificar um novo contato interessado, registre automaticamente como lead no CRM com os dados coletados durante a conversa.',
  ADD COLUMN IF NOT EXISTS prompt_schedule_visits text 
    DEFAULT 'Ofereça agendamento de visitas quando o lead demonstrar interesse em um imóvel específico. Pergunte data e horário preferidos dentro do horário disponível.',
  ADD COLUMN IF NOT EXISTS prompt_property_db text 
    DEFAULT 'Você tem acesso ao banco de imóveis da imobiliária. Use-o para buscar e recomendar imóveis que correspondam ao perfil do cliente.';