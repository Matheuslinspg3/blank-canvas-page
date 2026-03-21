

# Auditoria de Seguranca e Privacidade — Plano de Remediacao

## Resumo Executivo

A auditoria identificou **10 vulnerabilidades** em 4 categorias. Abaixo, priorizadas por severidade.

---

## Vulnerabilidades Encontradas

### CRITICAS (3)

| # | Problema | Risco |
|---|---------|-------|
| C1 | **Maintenance mode desativavel sem autenticacao** — endpoint `toggle-maintenance-mode` aceita `deactivate` sem JWT | Qualquer pessoa na internet pode desativar o modo manutencao |
| C2 | **PII de proprietarios exposta cross-org** — `marketplace_properties` expoe `owner_name/email/phone` para qualquer usuario autenticado de qualquer organizacao | Vazamento de dados pessoais (LGPD) |
| C3 | **Chaves de API de IA legiveis por qualquer manager** — `ai_provider_config` sem scoping por organizacao permite leitura de credenciais OpenAI/Anthropic/etc | Comprometimento de chaves de API |

### ALTAS (3)

| # | Problema | Risco |
|---|---------|-------|
| A1 | **XSS armazenado em templates de contrato** — HTML de IA renderizado via `dangerouslySetInnerHTML` sem sanitizacao (DOMPurify) | Execucao de script malicioso para todos os membros da org |
| A2 | **Token OAuth Meta exposto** — `ad_accounts.auth_payload` legivel por corretores via RLS | Acesso nao autorizado a contas de anuncios |
| A3 | **Views com SECURITY DEFINER** — 2 views bypassam RLS do usuario que consulta | Escalacao de privilegios |

### MEDIAS (3)

| # | Problema | Risco |
|---|---------|-------|
| M1 | **Feed token legivel por todos da org** — `portal_feeds.feed_token` sem restricao de role | Acesso externo ao feed por usuarios sem autorizacao |
| M2 | **Funcoes sem search_path fixo** — funcoes PL/pgSQL vulneraveis a search_path injection | Escalacao de privilegios via schema poisoning |
| M3 | **Leaked password protection desabilitada** — Supabase Auth nao verifica senhas comprometidas | Usuarios podem usar senhas ja vazadas |

### BAIXA (1)

| # | Problema | Risco |
|---|---------|-------|
| B1 | **console.log em producao** — ~196 ocorrencias em 16 arquivos | Vazamento de informacoes em DevTools |

---

## Plano de Correcao (por prioridade)

### Fase 1 — Criticas (implementacao imediata)

**C1: Proteger toggle-maintenance-mode**
- Remover excecao de deactivate sem auth
- Exigir JWT valido + role admin/developer para todas as acoes
- Arquivo: `supabase/functions/toggle-maintenance-mode/index.ts`

**C2: Isolar PII do marketplace**
- Migration SQL: remover `owner_name`, `owner_email`, `owner_phone` da policy SELECT publica
- Criar view `marketplace_properties_public` sem colunas PII
- Mover acesso a dados do proprietario para endpoint protegido por role

**C3: Restringir ai_provider_config**
- Migration SQL: alterar policy SELECT para exigir role `developer` ou `admin` apenas
- Ou mover chaves para Supabase Vault/secrets

### Fase 2 — Altas

**A1: Sanitizar HTML de contratos**
- Instalar `dompurify` + `@types/dompurify`
- Sanitizar em `ContractTemplateForm.tsx` e `ContractTemplatePreview.tsx` antes do `dangerouslySetInnerHTML`
- Sanitizar output da IA em `generate-contract-template` edge function

**A2: Proteger token Meta OAuth**
- Migration SQL: restringir SELECT de `ad_accounts` para `is_org_manager_or_above()`
- Ou criar view sem `auth_payload` para corretores

**A3: Corrigir SECURITY DEFINER views**
- Identificar as 2 views e alterar para SECURITY INVOKER ou remover

### Fase 3 — Medias

**M1:** Restringir `portal_feeds` SELECT a managers+
**M2:** Fixar `search_path = public` nas funcoes afetadas
**M3:** Habilitar Leaked Password Protection no dashboard Supabase (manual)

### Fase 4 — Baixa

**B1:** Substituir `console.log` por condicional `import.meta.env.DEV` nos arquivos de producao

---

## Detalhes Tecnicos

### Arquivos a modificar

```text
EDGE FUNCTIONS:
  supabase/functions/toggle-maintenance-mode/index.ts  (C1)
  supabase/functions/generate-contract-template/index.ts (A1)

MIGRATIONS SQL:
  marketplace_properties — remover PII da policy (C2)
  ai_provider_config — restringir SELECT (C3)
  ad_accounts — restringir SELECT (A2)
  portal_feeds — restringir SELECT (M1)
  views SECURITY DEFINER — corrigir (A3)
  funcoes search_path — fixar (M2)

FRONTEND:
  src/components/contracts/ContractTemplateForm.tsx (A1)
  src/components/contracts/ContractTemplatePreview.tsx (A1)
  package.json — adicionar dompurify (A1)

CONFIGURACAO MANUAL (Supabase Dashboard):
  Auth → Settings → Leaked Password Protection → Enable (M3)
```

### Estimativa

- Fase 1 (Criticas): ~3 migrations + 1 edge function edit
- Fase 2 (Altas): ~3 migrations + 2 frontend files + 1 dependencia
- Fase 3 (Medias): ~3 migrations + 1 config manual
- Fase 4 (Baixa): cleanup de logs

