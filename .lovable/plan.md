
# Fase 1 — Estabilização Retell AI

## Diagnóstico

**Pipeline atual (já existe e funciona estruturalmente):**
```
leads INSERT
 └─ trg_enqueue_voice_call_fn (migração 20260417004809)
     └─ voice_call_queue (status=pending)
         └─ voice-call-queue-worker (pg_cron 1min)
             └─ retell-trigger-outbound-call
                 └─ Retell API → voice_calls (registered)
                     └─ retell-webhook (started/ended/analyzed)
                         └─ retell-qualify-call + n8n
```

**Bloqueios encontrados:**

1. **`consent_voice_call` default = `false`** e **NENHUM** dos pontos de criação de lead seta `true`:
   - `supabase/functions/website-lead/index.ts` (linha ~54) — não envia o campo
   - `supabase/functions/create-site-lead/index.ts` (linha ~80) — não envia
   - `supabase/functions/rd-station-sync-leads/index.ts` (linha ~377) — não envia
   - `supabase/functions/meta-sync-leads/index.ts` (linha ~305) — não envia
   - `supabase/functions/crm-import-leads/index.ts` (linha ~430) — não envia
   - `supabase/functions/whatsapp-create-lead/index.ts` — não envia
   - `src/hooks/useLeadCRUD.ts` (linha 156) — não envia
   - **Resultado:** o trigger `trg_enqueue_voice_call_fn` aborta no IF da linha 112. Auto-dial nunca dispara.

2. **Trigger silencioso:** `RETURN NEW` sem log explica zero observabilidade — impossível saber por que um lead não entrou na fila.

3. **Worker silencioso:** `voice-call-queue-worker` só loga em catch. Sem motivos claros para "cancelled/postponed/failed".

4. **`retell-trigger-outbound-call`** loga só erros HTTP da Retell, não loga payload nem decisão.

5. **Sem teste ponta-a-ponta** disponível para admins.

---

## Arquivos alterados (8 + 1 migração + 1 nova função)

### A. Consentimento — regra central + propagação

**Decisão de regra (mecânica, não jurídica):**
| Origem | consent_voice_call | Justificativa |
|---|---|---|
| `meta_ads` / `anuncio` | `true` | Lead preenche formulário ativo do anúncio com telefone |
| `rdstation` | `true` (configurável via `rd_station_settings.auto_voice_consent`, default `true`) | Lead já passou por opt-in na origem |
| `website` / `landing_page` / `site` | `true` se payload incluir `consent_voice_call=true`; senão `false` | Site precisa ter checkbox; default seguro |
| `whatsapp` | `true` (cliente iniciou conversa) | Engajamento ativo |
| Manual (CRM) / `csv` import | `false` por default; UI permite marcar | Corretor pode ter cadastrado sem consentimento |

**1. `supabase/functions/_shared/voiceConsent.ts` (NOVO)** — utilitário central:
```ts
export type LeadOrigin = 'meta_ads'|'anuncio'|'rdstation'|'website'|'landing_page'|'site'|'whatsapp'|'manual'|'csv'|string;

export function resolveVoiceConsent(opts: {
  source?: string|null;
  explicit?: boolean|null;        // se UI/payload mandou explicitamente
  hasPhone: boolean;
}): boolean {
  if (!opts.hasPhone) return false;
  if (typeof opts.explicit === 'boolean') return opts.explicit;
  const s = (opts.source || '').toLowerCase();
  if (s.includes('meta') || s === 'anuncio') return true;
  if (s.includes('rdstation') || s.includes('rd_station')) return true;
  if (s === 'whatsapp') return true;
  return false; // website/landing/manual/csv default false
}
```

**2-7. Propagação:** adicionar `consent_voice_call: resolveVoiceConsent(...)` em cada insert de lead listado acima. Mudanças mínimas, 2-3 linhas por arquivo.

**8. `src/hooks/useLeadCRUD.ts`:** aceitar `consent_voice_call` no input (já passa via `...rest`); apenas adicionar checkbox no formulário de criação manual (`src/components/leads/LeadForm*.tsx` — verificar e ajustar).

### B. Validação de configuração Retell

**9. `supabase/functions/_shared/retellConfigCheck.ts` (NOVO):**
```ts
export function validateRetellConfig(cfg: any): { ok: boolean; reason?: string } {
  if (!cfg) return { ok: false, reason: 'config_not_found' };
  if (!cfg.enabled) return { ok: false, reason: 'integration_disabled' };
  if (!cfg.auto_outbound_enabled) return { ok: false, reason: 'auto_outbound_disabled' };
  if (!cfg.agent_id) return { ok: false, reason: 'missing_agent_id' };
  if (!cfg.retell_from_number) return { ok: false, reason: 'missing_from_number' };
  return { ok: true };
}
```
Usado em `retell-trigger-outbound-call` e `voice-call-queue-worker` para logar motivo claro de cancelamento.

### C. Observabilidade estruturada

Todos os logs no formato:
```ts
console.log(JSON.stringify({ scope, event, lead_id, org_id, queue_id, reason, ...extra }));
```

**10. `supabase/functions/voice-call-queue-worker/index.ts`** — logar:
- `picked_up` (id, attempt)
- `cancelled` com `reason` (config_invalid)
- `postponed` com `reason: outside_working_hours, next_attempt_at`
- `triggered_ok` (call_id)
- `failed` com erro + se vai retry ou final

**11. `supabase/functions/retell-trigger-outbound-call/index.ts`** — logar:
- `request_received` (lead_id, org_id, phone masked)
- `config_invalid` com reason
- `retell_request` (to_number masked, agent_id)
- `retell_response_ok` (call_id)
- `retell_error` (status, body)

**12. `supabase/functions/retell-webhook/index.ts`** — logar:
- `event_received` (event, call_id)
- `call_not_found` (warning)
- `updated` (event, fields)
- `n8n_forward_ok` / `n8n_forward_failed`

**13. Migração — log do trigger (opcional mas útil):** adicionar `RAISE NOTICE` no `trg_enqueue_voice_call_fn` quando aborta, e criar tabela leve `voice_call_skipped_log` (org_id, lead_id, reason, created_at) para visibilidade no dashboard. **Decisão: pular tabela nesta fase, usar apenas RAISE LOG** (aparece em postgres_logs). Mudança em 1 migração.

### D. Teste ponta-a-ponta

**14. `supabase/functions/retell-test-pipeline/index.ts` (NOVA)** — endpoint protegido (admin/developer da org via `auth.getUser()` + `has_role`):

```ts
// POST { phone, name?, dry_run? }
// 1. Valida retell_agent_config (usa validateRetellConfig)
// 2. Cria lead test com source='test_retell', consent_voice_call=true
// 3. Aguarda 2s, busca voice_call_queue para esse lead_id
// 4. Se dry_run=false: chama worker manualmente OU chama retell-trigger-outbound-call direto
// 5. Retorna timeline JSON: { config_check, lead_id, queue_id, queue_status, call_id?, errors[] }
```

**Botão na UI:** `src/components/automations/retell/RetellConfigTab.tsx` aba "outbound" — adicionar botão **"Testar pipeline (ligar para meu número)"** que abre modal pedindo telefone do admin, chama `retell-test-pipeline`, e mostra timeline.

---

## Instruções para teste manual (após deploy)

1. **Settings → Automações → Retell** → confirmar `enabled`, `auto_outbound_enabled`, `agent_id`, `retell_from_number`, horário comercial 08-18.
2. Aba Outbound → clicar **"Testar pipeline"** → digitar seu celular → confirmar.
3. Verificar timeline na resposta: `config_check.ok=true`, `queue_status=done`, `call_id` presente.
4. Receber a ligação. Falar com o agente. Encerrar.
5. CRM → ver lead "Teste Retell" criado, anotações de qualificação após webhook `call_analyzed`.
6. Logs: Edge Functions → filtrar `scope":"retell"` para ver fluxo estruturado.
7. Teste real com Meta Ad: criar lead via Meta Ads → verificar `consent_voice_call=true` no DB → ligação automática em até 60s.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Auto-dial dispara para leads importados em massa (CSV antigo com `source=csv`) | Default mantido `false` para `csv`; só dispara se admin marcar opt-in |
| Lead Meta sem telefone válido cai no normalize e é descartado silenciosamente | Trigger já tem `RAISE LOG` no normalize falhar (adicionar) |
| Endpoint de teste abusado | Restringir a `has_role(admin|developer)`, rate limit por org |
| Logs com PII (telefone) | Mascarar para `+55**********34` em logs |
| Mudança de `retell-webhook` quebra n8n existente | Não altera contrato, só adiciona logs |

## Fora de escopo (Fase 2)

HMAC do `retell-webhook`, round-robin real de brokers, respeito a `min_minutes_between_attempts`, outbox/retry de n8n, webhook real-time Meta. Deixados como está.
