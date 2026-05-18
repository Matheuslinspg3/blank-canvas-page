# Edge Functions Security Audit (resumo)

`supabase/config.toml` contém várias funções com `verify_jwt=false`.

## Públicas legítimas (aparente)
- webhooks/callbacks (ex.: `meta-messaging-webhook`, `rd-station-webhook`, `meta-oauth-callback`).
- endpoints de captura pública (ex.: `website-lead`, `og-metadata`).

## Sensíveis para revisão prioritária
- funções administrativas e de exportação (`admin-users`, `admin-subscriptions`, `export-database`, `toggle-maintenance-mode`).
- funções com potencial de dados sensíveis/AI (`ai-router`, `generate-*`, `ticket-chat`).

## Recomendações
- Criar allowlist de origem por função pública.
- Aplicar wrapper comum (`requireAuth`, `requireRole`, `requireOrgScope`) para funções internas.
- Adicionar rate limit e validação estrita em payloads públicos.
