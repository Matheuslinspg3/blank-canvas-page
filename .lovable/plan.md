

# Inventário Completo de IA do Projeto Habitae

## 1. CASOS DE USO DE IA JÁ EXISTENTES

| # | Nome | Objetivo | Entrada | Processamento | Saída | Tela/Módulo | Usuário | Valor | Risco |
|---|------|----------|---------|---------------|-------|-------------|---------|-------|-------|
| 1 | **Agente WhatsApp** | Atendimento 24/7 automatizado | Mensagem texto/áudio do cliente | N8N → whatsapp-webhook-config → LLM com tools (buscar imóveis, criar lead, enviar fotos, transferir, agendar) | Resposta texto + fotos + ações CRM | WhatsApp (via n8n) | Cliente, Corretor, Admin | Atendimento ininterrupto, qualificação automática | Alucinação, custo tokens, dependência provedor |
| 2 | **Qualificação de Leads (WhatsApp)** | Extrair dados estruturados da conversa | Histórico de mensagens | LLM extrai renda, tipo_imóvel, região, urgência, score | JSON com campos qualificados + score 0-100 | CRM / Lead detail | Admin, Corretor | Priorização automática | Dados incompletos, falsos positivos |
| 3 | **Resumo de Lead** | Gerar resumo contextual para o corretor | Dados do lead + interações + mensagens | Edge Function `summarize-lead` → ai-router | Texto resumo (cacheado 24h em `ai_summary`) | CRM / Ficha do Lead | Corretor, Admin | Economia de tempo, contexto rápido | Cache desatualizado |
| 4 | **Follow-up Inteligente** | Gerar mensagens personalizadas de follow-up | Contexto do lead + template_index | ai-router (task_type: chat) gera texto | Mensagem personalizada enviada via WhatsApp | Automação (fila follow_up_queue) | Admin (config), Cliente (recebe) | Re-engajamento automatizado | Mensagem genérica, spam |
| 5 | **Boas-vindas Rotativas** | Gerar sequências de boas-vindas com teste A/B | Config do agente + contexto org | Edge Function `whatsapp-generate-welcomes` → ai-router | Array de mensagens de boas-vindas | Config WhatsApp / Boas-vindas | Admin | Engajamento inicial, conversão | Repetição, tom inadequado |
| 6 | **Geração de Anúncios (Texto)** | Criar copy para portais, Instagram, WhatsApp | Dados do imóvel + tom + canal | Edge Function `generate-ad-content` → ai-router | Textos por canal (portal, instagram, whatsapp) | Gerador de Anúncios | Admin, Corretor | Produtividade em marketing | Tom inconsistente |
| 7 | **Geração de Arte (Imagem)** | Criar arte visual do imóvel | Foto do imóvel + template + texto | Edge Function `generate-ad-image` → ai-router (image) | Imagem PNG com overlay | Gerador de Artes | Admin, Corretor | Material visual sem designer | Qualidade variável |
| 8 | **Geração de Vídeo** | Criar vídeo promocional do imóvel | Fotos + dados do imóvel | Edge Function `generate-property-video` → processamento VPS | Vídeo MP4 | Gerador de Vídeos | Admin | Conteúdo rich media | Tempo de processamento, custo VPS |
| 9 | **Análise de Qualidade de Foto** | Avaliar qualidade das fotos de imóveis | URL da imagem | Edge Function `analyze-photo-quality` → LLM Vision | Score de qualidade + feedback | Gerador de Artes | Admin, Corretor | Garantia de qualidade visual | Subjetividade, custo vision |
| 10 | **Remoção de Fundo** | Remover background de imagens/logos | URL da imagem | Edge Function `remove-bg` → Gemini Image Edit | PNG com fundo transparente | Configurações / Brand | Admin | Economia de edição gráfica | Edges imprecisas |
| 11 | **Geração de Site v2** | Criar layout completo do site builder | Respostas do wizard + dados da org + imóveis | Edge Function `generate-site-v2` → LLM gera JSON de seções | Layout JSON (draft_v2) | Site Builder | Admin | Site profissional em minutos | Layout genérico |
| 12 | **Geração de Conteúdo de Site** | Gerar textos para blocos do site | Dados da org + tipo de bloco | Edge Function `generate-site-content` / `generate-landing-content` | Textos HTML para seções | Site Builder | Admin | Copy profissional sem copywriter | Tom genérico |
| 13 | **Geração de Template de Contrato** | Criar modelo de contrato via IA | Tipo (venda/locação) + descrição | Edge Function `generate-contract-template` → ai-router | HTML do contrato com variáveis | Contratos / Templates | Admin | Modelos jurídicos rápidos | Imprecisão jurídica |
| 14 | **Preenchimento de Contrato via IA** | Preencher campos de contrato com linguagem natural | Texto livre do usuário | Edge Function `contract-ai-fill` → LLM | JSON com campos preenchidos | Contratos / Novo Contrato | Admin | UX simplificada | Campos errados |
| 15 | **Extração de PDF de Imóveis** | Extrair dados estruturados de PDFs | Arquivo PDF | Edge Function `extract-property-pdf` → Gemini | JSON com dados do imóvel | Imóveis / Importar PDF | Admin | Cadastro rápido de imóveis | Parsing incorreto |
| 16 | **Validação de Documentos** | Validar documentos de leads (RG, CPF, comprovante) | Imagem/PDF do documento | Edge Function `validate-document` → LLM Vision | JSON com tipo + dados extraídos + validação | CRM / Documentos do Lead | Admin, Corretor | Conferência automática | Falsos positivos/negativos |
| 17 | **Voz (Retell AI - Sofia)** | Assistente de voz para atendimento por telefone | Chamada de voz WebRTC | Retell AI com fluxo de steps | Conversa de voz + transcrição + qualificação | Painel Voz | Admin, Cliente | Atendimento telefônico 24/7 | Custo Retell, qualidade STT |
| 18 | **Qualificação Pós-Chamada** | Analisar transcrição de chamada de voz | Transcrição da chamada | Edge Function `retell-qualify-call` → ai-router | Score + dados do lead + criação automática | Automação (pós-chamada) | Admin | Conversão de chamadas em leads | Dependência de transcrição |
| 19 | **ElevenLabs TTS (WhatsApp)** | Respostas de voz no WhatsApp | Texto da resposta da IA | Edge Function `elevenlabs-tts` | Áudio OGG enviado via WhatsApp | WhatsApp (prefixo #VOZAI) | Cliente | Experiência rica em áudio | Custo ElevenLabs, latência |
| 20 | **Chat de Suporte (Tickets)** | Anamnese automática antes de escalar | Mensagem do usuário + histórico | Edge Function `ticket-chat` → ai-router (3 perguntas) | Respostas + webhook n8n ao concluir | Suporte / Tickets | Todos | Triagem automática | Perguntas irrelevantes |
| 21 | **AI Router (Infra)** | Roteamento inteligente entre provedores | task_type + prompt + config | Scoring por custo/velocidade/confiabilidade → fallback chain | Texto/imagem do melhor provedor | Infraestrutura (todas as features) | Sistema | Resiliência, otimização de custo | Complexidade, debugging |

---

## 2. CASOS DE USO DE IA RECOMENDADOS

## 3. DETALHAMENTO DE CADA CASO RECOMENDADO

| # | Caso de Uso | Problema Resolvido | Impacto | Complexidade | Dependências | Quando Implementar | KPI | Riscos | Regra vs IA vs Híbrido |
|---|-------------|-------------------|---------|-------------|--------------|-------------------|-----|--------|----------------------|
| A | **Scoring Preditivo de Leads** | Score atual é estático (baseado em campos). Não reflete probabilidade real de conversão | Alto: prioriza leads com maior chance de fechar | Média-alta | Histórico de leads convertidos (>200 exemplos), interações, tempo no funil | Fase 3 (6-12m) | Taxa de conversão dos top-20% leads | Viés do modelo, cold start | **Híbrido**: regra para score base + ML para ajuste preditivo |
| B | **Matching Automático Lead↔Imóvel** | Corretor busca manualmente imóveis para cada lead | Alto: acelera ciclo comercial | Média | Preferências extraídas (qualificação), catálogo atualizado | Fase 2 (3-6m) | % de leads que recebem recomendação aceita | Recomendação fora do perfil | **IA**: embedding de preferências vs atributos do imóvel |
| C | **Matching Corretor↔Lead** | Distribuição é round-robin ou manual | Médio: melhora conversão por especialização | Média | Histórico de vendas por corretor, região, tipo de imóvel | Fase 3 (6-12m) | Conversão por corretor, tempo de resposta | Desequilíbrio de distribuição | **Híbrido**: regra (região/tipo) + IA (afinidade) |
| D | **Copiloto Comercial** | Corretor não sabe próximo passo ideal | Alto: guia ação comercial | Alta | Dados completos do funil, interações, agenda | Fase 3 (6-12m) | Ações sugeridas executadas, tempo médio de fechamento | Over-reliance, sugestões erradas | **IA**: LLM com contexto do lead + histórico |
| E | **Resumo de Conversas WhatsApp** | Admin/corretor precisa ler thread inteira | Médio: economia de tempo | Baixa | whatsapp_messages já existe | Fase 1 (quick win) | Tempo médio de revisão de conversa | Resumo incompleto | **IA**: summarization simples |
| F | **Previsão de Fechamento** | Sem visibilidade de pipeline futuro | Alto: planejamento financeiro | Alta | Histórico de contratos, tempo médio por etapa | Fase 4 (12m+) | Acurácia da previsão vs realizado | Dados insuficientes | **ML**: regressão sobre features do lead |
| G | **Auditoria de Operação** | Sem visibilidade de anomalias operacionais | Médio: compliance e qualidade | Média | Logs de ações, leads sem follow-up, SLA de resposta | Fase 2 (3-6m) | Anomalias detectadas/resolvidas | Falsos alertas | **Regra**: queries SQL + alertas (IA só para resumo) |
| H | **Previsão de Inadimplência** | Cobranças reativas, sem prevenção | Médio-alto: reduz inadimplência | Alta | Histórico de pagamentos (locação), perfil do locatário | Fase 4 (12m+) | % de inadimplência prevenida | Poucos dados iniciais | **ML**: classificação binária |
| I | **Recomendação de Preço** | Precificação por feeling do corretor | Alto: competitividade e margem | Alta | Dados de mercado, comparáveis, localização | Fase 3 (6-12m) | % de imóveis com preço sugerido aceito | Mercado volátil, dados escassos | **Híbrido**: comparáveis (regra) + ajuste IA |
| J | **Motor de Next Best Action** | Cada usuário decide o que fazer sem orientação | Alto: produtividade geral | Alta | Todos os módulos integrados | Fase 4 (12m+) | Ações sugeridas executadas, receita incremental | Complexidade, manutenção | **IA**: agente com contexto completo |
| K | **IA para Onboarding** | Alta taxa de abandono no setup | Médio: ativação de novos clientes | Baixa-média | Dados da org, wizard de setup | Fase 2 (3-6m) | % de orgs que completam setup, time-to-first-value | Sugestões erradas | **IA**: chatbot guiado com checklist |
| L | **IA para Financeiro** | Categorização manual de transações | Médio: automação contábil | Média | Histórico de transações categorizadas | Fase 3 (6-12m) | % de categorizações automáticas corretas | Erro fiscal | **Híbrido**: regras + IA para novos padrões |
| M | **IA para Compliance** | Verificação manual de documentação | Médio: redução de risco jurídico | Média | Documentos de leads, regras LGPD | Fase 3 (6-12m) | Docs validados automaticamente, tempo de compliance | Falso senso de segurança | **Híbrido**: checklist (regra) + validação IA |
| N | **Enriquecimento de Cadastro** | Leads com dados incompletos | Médio: qualidade de dados | Baixa | APIs externas (Receita Federal, redes sociais) | Fase 2 (quick win com APIs) | % de leads com telefone/email completo | Custo de APIs, dados desatualizados | **Regra**: APIs de enriquecimento (sem LLM) |

---

## 4. PRIORIZAÇÃO

### Quick Wins (baixo esforço, impacto imediato)
- **E. Resumo de Conversas WhatsApp** — já tem dados, edge function `summarize-lead` pode ser estendida
- **N. Enriquecimento de Cadastro** — APIs prontas, sem LLM
- **G. Auditoria de Operação** — queries SQL + dashboard

### Alto Impacto
- **B. Matching Lead↔Imóvel** — acelera conversão diretamente
- **D. Copiloto Comercial** — guia corretor em tempo real
- **A. Scoring Preditivo** — priorização inteligente

### Alto Esforço
- **F. Previsão de Fechamento** — requer ML + histórico robusto
- **H. Previsão de Inadimplência** — dados financeiros limitados
- **J. Motor Next Best Action** — integração total necessária

### Diferenciação Estratégica
- **I. Recomendação de Preço** — único no mercado imobiliário brasileiro
- **J. Motor Next Best Action** — barreira competitiva alta
- **D. Copiloto Comercial** — nenhum CRM imobiliário oferece

---

## 5. ARQUITETURA DE IA SUGERIDA

### Prompts
- **System prompts versionados**: armazenar em `ai_router_config.system_prompt` com histórico de versões (campo `prompt_version`)
- **Prompt templates parametrizados**: usar variáveis (`{agent_name}`, `{org_name}`, `{tone}`) — já implementado parcialmente
- **Prompt library**: tabela centralizada para reutilização entre features

### Ferramentas (Tools)
- **Tool registry centralizado**: hoje cada workflow n8n configura tools manualmente. Criar tabela `ai_tools` com schema/descrição que o agente consulta dinamicamente
- **Padronizar interface**: todas as tools Edge Function recebem `{ organization_id, user_id, ...params }` e retornam `{ success, data, error }`

### Memória / Contexto
- **Curto prazo**: histórico de mensagens (whatsapp_messages) — já existe
- **Médio prazo**: resumo do lead (ai_summary) — já existe, expandir para "memória do agente" por contato
- **Longo prazo**: preferências aprendidas do lead (embedding em `lead_preferences`)
- **RAG**: indexar catálogo de imóveis com embeddings para busca semântica (substituir busca SQL atual)

### Observabilidade
- **Já existente**: `ai_router_logs`, `ai_token_usage_events`, `ai_usage_logs`
- **Adicionar**: latência p50/p95 por provider, taxa de fallback, quality score (feedback humano), custo acumulado por org com alertas
- **Dashboard**: já existe `AIUsageDashboard` e `AILogsTable` — expandir com gráficos de tendência

### Avaliação
- **Feedback loop**: botão 👍/👎 nas respostas do agente (WhatsApp e chat) → tabela `ai_feedback`
- **A/B testing**: já existe para boas-vindas, expandir para prompts do agente
- **Eval automático**: batch de perguntas-padrão com respostas esperadas, rodar semanalmente

### Fallback
- **Provider chain**: já implementado no ai-router (scoring por custo/velocidade/confiabilidade)
- **Adicionar**: resposta padrão quando TODOS os providers falham ("Estou com dificuldades, um corretor vai te atender")
- **Circuit breaker**: já existe (`consecutive_errors`, `last_error_at`) — adicionar auto-recovery

### Humano no Loop
- **Handoff**: já existe via `whatsapp-transfer-broker` com contexto
- **Adicionar**: flag de confiança — quando score < threshold, marcar para revisão humana antes de enviar
- **Aprovação de contratos**: IA gera draft, humano revisa (já funciona assim)

### Custos
- **Billing**: já implementado (ai_credit_wallets + automation_credit_wallets, markup 1.5x)
- **Adicionar**: alertas proativos quando saldo < 20% do allowance mensal
- **Otimização**: cache de respostas frequentes, prompts mais curtos para tarefas simples

### Segurança
- **Rate limiting**: Upstash Redis (30 req/h) — já existe
- **Sanitização**: HTML sanitizer em contratos — já existe
- **PII**: não enviar dados sensíveis (CPF, renda) desnecessariamente ao LLM
- **Adicionar**: audit log de todas as chamadas de IA com hash do prompt (sem armazenar PII)

### Governança
- **BYOK vs Platform**: já suportado (ai_mode: "platform" | "byok")
- **Modelo por task**: já configurável via ai_router_config
- **Adicionar**: política de retenção de logs de IA (>90 dias → archive)
- **Compliance LGPD**: consentimento explícito antes de processar dados pessoais via IA

---

## Implementação

O documento será gerado como DOCX profissional com todas as tabelas formatadas, totalizando as 5 seções acima, e salvo em `/mnt/documents/Habitae_Inventario_IA.docx`.

### Arquivos alterados
- Nenhum arquivo do projeto será modificado
- Apenas geração de artefato em `/mnt/documents/`

