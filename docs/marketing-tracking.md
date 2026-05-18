# Marketing Tracking (Meta Ads / GA4 / CAPI)

## Variáveis de ambiente
Frontend:
- `VITE_ENABLE_MARKETING_TRACKING`
- `VITE_META_PIXEL_ID`
- `VITE_GA4_MEASUREMENT_ID`

Backend:
- `META_CAPI_ENABLED`
- `META_PIXEL_ID`
- `META_ACCESS_TOKEN`
- `META_TEST_EVENT_CODE`
- `META_CAPI_ALLOWED_ORIGINS` (lista CSV opcional para allowlist de Origin)

## Implementado
- Captura first-party de UTMs, click IDs, landing/referrer e persistência de 90 dias em `localStorage`.
- Envio de `attribution_context` no signup e no website-lead (com fallback seguro).
- Eventos frontend: `PageView`, `ViewContent`, `FormStarted`, `Lead`, `CompleteRegistration`, `ClickWhatsApp`.
- Tabela `attribution_events` com RLS para trilha server-side.
- Edge Function `meta-conversions-api` com hash de email/telefone apenas no backend.

## Segurança e privacidade
- Sem secrets hardcoded.
- Sem envio de PII bruta para Meta Pixel/GA4 no frontend.
- No CAPI, `email` e `phone` são normalizados/hasheados no backend antes do envio.
- `meta-conversions-api` aplica validação estrita de evento, limite de payload e allowlist de origem opcional.
- `verify_jwt=false` em `meta-conversions-api` permanece para suportar eventos anônimos de frontend; mitigação: enable por env + validação estrita + allowlist de origem.

## QA manual (checklist)
1. Abrir URL com UTMs (`?utm_source=meta&utm_campaign=test&fbclid=123`).
2. Verificar `localStorage.porta_attribution_context_v1`.
3. Iniciar cadastro (evento `FormStarted`).
4. Concluir cadastro (evento `CompleteRegistration`).
5. Validar `user_metadata` no Supabase Auth.
6. Enviar `website-lead` (payload antigo e payload novo com `attribution_context`).
7. Validar inserção em `public.attribution_events`.
8. Validar Meta Pixel em **Test Events** (event_id presente).
9. Validar GA4 em **DebugView**.
10. Validar CAPI com `META_TEST_EVENT_CODE`.

## Limitações atuais
- Eventos avançados na área logada (ex.: `OnboardingCompleted`, `LeadStatusChanged`, `ClienteAtivado`) ainda requerem instrumentação por módulo.
