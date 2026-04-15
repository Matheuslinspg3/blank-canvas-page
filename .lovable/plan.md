
# Plano: Gerar Documento Técnico Completo do Projeto Habitae

## Objetivo
Criar um documento DOCX profissional com 11 seções técnicas cobrindo arquitetura, stack, modelagem de dados, permissões, automações, IA, integrações, dívida técnica e roadmap.

## Conteúdo a ser gerado

O documento será construído com base em toda a informação coletada:

### 1. ARQUITETURA GERAL
- SPA React/Vite → Supabase (Postgres + Auth + Edge Functions + Storage)
- N8N como orquestrador fino chamando Edge Functions via HTTP
- Multi-tenant via RLS com `get_user_organization_id()`
- Storage tri-provider: Supabase (docs RLS), R2 (mídia imóveis, pHash), Cloudinary (logos/brand)
- WhatsApp via Evolution API + wa-worker (Baileys 6+)
- Wildcard DNS via Cloudflare Worker para subdomínios white-label

### 2. STACK E TECNOLOGIAS
React 18, TypeScript, Vite 5, Tailwind CSS v3, shadcn/ui, Supabase (Postgres, Auth, Edge Functions Deno, Storage), N8N v2.15.0, Cloudflare R2/Workers, Cloudinary, Google Maps Embed, OneSignal, PostHog, Upstash Redis, Evolution API, Retell AI, ElevenLabs, OpenAI/Anthropic/Gemini/Groq, Firecrawl, vite-plugin-pwa

### 3. MODELAGEM DE DADOS
~40+ tabelas detalhadas: organizations, profiles, user_roles, properties, property_images, leads, lead_stages, contracts, commissions, transactions, invoices, whatsapp_agent_config, whatsapp_messages, follow_up_queue, subscription_plans, marketplace_properties, etc.

### 4. RELACIONAMENTOS
Org→Profiles→User_roles, Properties→Property_images, Leads→Lead_stages→Interactions, Contracts→Properties+Leads+Commissions, etc.

### 5. PERMISSÕES E PAPÉIS
6 roles: developer > admin > sub_admin > leader > corretor > assistente. RLS strict, Security Definer functions.

### 6. AUTOMAÇÕES
~120+ Edge Functions mapeadas, n8n workflows, pg_cron jobs, triggers (handle_new_user, auto_create_lead, lead dedup, follow-up sync)

### 7. IA NO DETALHE
Agente WhatsApp (tools: busca imóveis, create/update lead, transfer broker, envio fotos), Retell Voice (Sofia), ElevenLabs TTS, Gemini PDF extraction, AI site generation, ad content generation, lead summarization, photo quality analysis. Billing via créditos BRL com markup 1.5x.

### 8. INTEGRAÇÕES
WhatsApp (Evolution API), Meta Ads (OAuth), RD Station CRM, Imobzi, portais XML (ZAP/Viva Real), Retell AI, ElevenLabs, Cloudinary, Cloudflare R2, OneSignal, Firecrawl, Stripe/billing

### 9. PONTOS FRÁGEIS
N8N version lock, prompt engineering contínuo, complexidade DNS/SSL, custo tokens, falta de testes automatizados, dependência de provedores externos

### 10. ROADMAP
4 fases: Fundamentos → Eficiência → Inteligência → Escala

### 11. RESUMO TÉCNICO FINAL

## Implementação
- Script Node.js usando biblioteca `docx` (já instalada em /tmp)
- Documento formatado com tabelas, bullets, headings, page breaks
- Output: `/mnt/documents/Habitae_Documentacao_Tecnica.docx`
- QA via parse_document para verificar completude

## Arquivos alterados
- Nenhum arquivo do projeto será modificado
- Apenas geração de artefato em `/mnt/documents/`
