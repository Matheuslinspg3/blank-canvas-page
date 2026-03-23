# Auditoria de Integridade de Dados — Porta do Corretor
**Data:** 2026-03-23

---

## 1. Mapa de Riscos de Integridade

| # | Risco | Tabela(s) | Prob. | Impacto | Tipo |
|---|-------|----------|-------|---------|------|
| I1 | `leads.stage` (enum) e `leads.lead_stage_id` (FK) coexistem — dual source of truth | `leads` | Alta | 🔴 Semântica conflitante | Estrutural |
| I2 | `leads.interested_property_type_id` (singular) e `interested_property_type_ids` (array) coexistem | `leads` | Alta | 🟡 Ambiguidade de consulta | Semântica |
| I3 | `contracts.code` sem UNIQUE constraint no banco | `contracts` | Média | 🔴 Códigos duplicados | Estrutural |
| I4 | `contracts.end_date` pode ser < `start_date` — sem CHECK | `contracts` | Baixa | 🟡 Dados incoerentes | Semântica |
| I5 | `commissions.amount` pode ser negativo — sem CHECK | `commissions` | Baixa | 🟡 Comissão inválida | Semântica |
| I6 | `invoices.status = 'pago'` sem `paid_at` ou vice-versa | `invoices` | Média | 🟡 Inconsistência estado/data | Semântica |
| I7 | `transactions.paid = true` sem `paid_at` | `transactions` | Média | 🟡 Inconsistência estado/data | Semântica |
| I8 | `properties.sale_price` e `rent_price` ambos NULL para `transaction_type = 'venda'` | `properties` | Média | 🟡 Imóvel sem preço | Semântica |
| I9 | `profiles.organization_id` nullable — perfil sem org é estado ambíguo | `profiles` | Baixa | 🟢 Esperado (onboarding) | Estrutural |
| I10 | OAuth tokens em texto plano (`rd_station_settings`, `ad_accounts.auth_payload`) | Múltiplas | Alta | 🔴 Segurança | Dados sensíveis |
| I11 | Sem soft delete em `leads`, `contracts`, `properties` — hard delete perde histórico | Múltiplas | Alta | 🔴 Perda irreversível | Retenção |
| I12 | `property_images` sem ON DELETE CASCADE — orphan images ao deletar property | `property_images` | Média | 🟡 Lixo no storage | Estrutural |
| I13 | Sem `updated_at` trigger automático na maioria das tabelas | Múltiplas | Alta | 🟡 Staleness de cache | Auditoria |
| I14 | `lead_stages.organization_id` nullable — stages globais e por-org misturados | `lead_stages` | Média | 🟡 Ambiguidade de escopo | Semântica |
| I15 | `contracts.broker_id` sem FK explícita para `profiles` | `contracts` | Baixa | 🟡 Referência solta | Estrutural |
| I16 | Sem histórico de mudanças em `leads` (stage transitions, broker changes) | `leads` | Alta | 🔴 Sem rastreabilidade CRM | Auditoria |
| I17 | `subscriptions.current_period_end` pode estar no passado sem mudança de status | `subscriptions` | Média | 🟡 Status stale | Semântica |
| I18 | Tabelas de log crescem indefinidamente sem política de retenção | `audit_events`, `ai_router_logs`, etc. | Alta | 🟡 Performance/custo | Retenção |

---

## 2. Dados Sensíveis e Críticos

### 🔴 Dados que exigem máxima proteção

| Dado | Tabela | Risco | Estado Atual |
|------|--------|-------|-------------|
| OAuth access/refresh tokens (Meta) | `ad_accounts.auth_payload` (JSON) | Acesso permite controle de conta Meta Ads | ❌ Texto plano |
| OAuth tokens (RD Station) | `rd_station_settings.oauth_*` | Acesso permite controle de conta RD Station | ❌ Texto plano |
| API keys Imobzi | `imobzi_api_keys.api_key` | Acesso permite leitura de todos os imóveis | ❌ Texto plano |
| Chaves de IA | `ai_router_providers.api_key` | Consumo indevido, custos | ⚠️ Protegida por view `_safe` mas coluna existe |
| WhatsApp instance tokens | `whatsapp_instances.instance_token` | Envio de mensagens em nome da empresa | ❌ Texto plano |
| Webhook secrets | `rd_station_settings.webhook_secret` | Forjar webhooks | ❌ Texto plano |

### 🟡 Dados críticos ao negócio

| Dado | Tabela | Criticidade |
|------|--------|------------|
| Valor de contrato | `contracts.value` | Financeiro — auditoria obrigatória |
| Comissões | `commissions.amount/percentage` | Financeiro — requer log de alteração |
| Status de assinatura | `subscriptions.status` | Controla acesso à plataforma |
| Score de lead | `leads.score` | Priorização comercial — derivado |
| Pagamentos billing | `billing_payments.amount_cents/status` | Financeiro — reconciliação com Asaas |

---

## 3. Gaps de Constraints, Auditoria e Histórico

### 3.1 Constraints Ausentes

| Tabela | Constraint Faltante | Tipo | Prioridade |
|--------|-------------------|------|-----------|
| `contracts` | `UNIQUE(organization_id, code)` | Unicidade | 🔴 Alta |
| `contracts` | Trigger: `end_date >= start_date` | Validação | 🟡 Média |
| `contracts` | Trigger: `payment_day BETWEEN 1 AND 31` | Range | 🟡 Média |
| `commissions` | Trigger: `amount >= 0` e `percentage BETWEEN 0 AND 100` | Range | 🟡 Média |
| `invoices` | Trigger: `amount > 0` | Range | 🟡 Média |
| `transactions` | Trigger: `amount > 0` | Range | 🟡 Média |
| `properties` | Trigger: `sale_price > 0 WHEN transaction_type IN ('venda','ambos')` | Condicional | 🟢 Baixa |
| `property_visits` | Trigger: `scheduled_at > created_at` | Temporal | 🟢 Baixa |
| `platform_invites` | Trigger: `expires_at > created_at` | Temporal | 🟢 Baixa |

### 3.2 Auditoria Ausente

| Entidade | O que falta | Impacto |
|---------|-----------|---------|
| `leads` | Histórico de mudanças de stage, broker, temperatura | Sem visibilidade comercial |
| `contracts` | Histórico de mudanças de status, valor | Sem auditoria financeira |
| `commissions` | Log quando marcada como paga | Sem rastreabilidade financeira |
| `subscriptions` | Histórico de mudanças de status/plano | Sem rastreabilidade billing |
| `profiles` | Log de mudanças de role/permissão | Requisito de segurança |

**Nota:** `audit_events` e `activity_log` existem, mas são populados *manualmente* pelo frontend via hooks (`useAuditLog`, `useActivityLogger`). Se o frontend não chamar, a ação não é registrada. Ações via Edge Functions (webhooks, crons) não passam por esses hooks.

### 3.3 Histórico — Boas Práticas Existentes

| Tabela | O que já rastreia | ✅ |
|--------|------------------|---|
| `property_status_history` | Mudanças de status de imóvel | ✅ Bom |
| `billing_webhook_logs` | Todos os webhooks de pagamento | ✅ Bom |
| `rd_station_webhook_logs` | Webhooks do RD Station | ✅ Bom |
| `ai_router_logs` | Todas as chamadas de IA | ✅ Bom |
| `import_runs` / `import_run_items` | Detalhes de importação | ✅ Excelente |
| `maintenance_audit_log` | Mudanças de modo manutenção | ✅ Bom |

---

## 4. Problemas de Semântica e Compatibilidade

### 4.1 Dual Source of Truth: `leads.stage` vs `leads.lead_stage_id`

**Problema:** `leads` tem DOIS campos que representam o estágio:
- `stage` — enum `lead_stage` com valores fixos (`novo`, `contato`, etc.)
- `lead_stage_id` — FK para `lead_stages` (tabela customizável por org)

**Impacto:** Queries podem usar um ou outro. Se ambos divergem, lead fica em estado inconsistente.

**Solução:** Migrar para usar apenas `lead_stage_id`. Depreciar `stage` gradualmente:
1. Garantir que toda escrita popula `lead_stage_id`
2. Backfill records antigos sem `lead_stage_id`
3. Após validação, remover coluna `stage` (breaking change — requer frontend update)

### 4.2 Dual Array: `interested_property_type_id` vs `interested_property_type_ids`

**Problema:** Campo singular e array coexistem na tabela `leads`.
**Solução:** Migrar para usar apenas `interested_property_type_ids` (array). Backfill o singular para dentro do array.

### 4.3 Enums em Português com Variação

**Status atual:** Enums misturam português e inglês:
- `contract_status`: `rascunho`, `ativo`, `encerrado`, `cancelado` (PT)
- `partnership_status`: `pending`, `active`, `rejected`, `expired` (EN)
- `visit_status`: `scheduled`, `confirmed`, `completed`, `cancelled` (EN)
- `app_role`: `admin`, `corretor`, `assistente`, `developer`, `leader` (misto)

**Risco:** Não é um bug, mas dificulta manutenção. `app_role` tem sinônimos (`developer` e `desenvolvedor` coexistem).

**Solução:** Não alterar agora (breaking change). Documentar a convenção e normalizar apenas `app_role` removendo `desenvolvedor` (se não usado).

### 4.4 `availability_status` (text) vs `status` (enum) em `properties`

**Problema:** `properties` tem `status` (enum: `disponivel`, `vendido`, etc.) E `availability_status` (text, default `'disponivel'`).
**Risco:** Dois campos para semântica similar — queries podem usar o errado.
**Solução:** Documentar qual é a source of truth. `status` é o principal; `availability_status` é para lógica de marketplace.

---

## 5. Proposta de Evolução de Schema com Segurança

### Fase 1 — Constraints e Validação (sem breaking changes)

```sql
-- I3: Unicidade de código de contrato por org
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_org_code 
ON contracts(organization_id, code);

-- I4: Validação de datas em contratos (trigger, não CHECK)
CREATE OR REPLACE FUNCTION validate_contract_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.start_date IS NOT NULL 
     AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date cannot be before start_date';
  END IF;
  IF NEW.payment_day IS NOT NULL AND (NEW.payment_day < 1 OR NEW.payment_day > 31) THEN
    RAISE EXCEPTION 'payment_day must be between 1 and 31';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- I5: Validação de comissões
CREATE OR REPLACE FUNCTION validate_commission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount < 0 THEN RAISE EXCEPTION 'amount cannot be negative'; END IF;
  IF NEW.percentage < 0 OR NEW.percentage > 100 THEN 
    RAISE EXCEPTION 'percentage must be between 0 and 100'; 
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- I6/I7: Auto-set paid_at quando status = pago
CREATE OR REPLACE FUNCTION sync_paid_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  IF NEW.paid = true AND NEW.paid_at IS NULL THEN
    NEW.paid_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fase 2 — Auditoria Automática via Triggers

```sql
-- Trigger genérico para log de mudanças em campos críticos
CREATE OR REPLACE FUNCTION audit_field_change()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields text[] := '{}';
BEGIN
  -- Detect changed fields dynamically
  IF TG_TABLE_NAME = 'leads' THEN
    IF OLD.lead_stage_id IS DISTINCT FROM NEW.lead_stage_id THEN
      changed_fields := array_append(changed_fields, 'lead_stage_id');
    END IF;
    IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
      changed_fields := array_append(changed_fields, 'broker_id');
    END IF;
    IF OLD.temperature IS DISTINCT FROM NEW.temperature THEN
      changed_fields := array_append(changed_fields, 'temperature');
    END IF;
  END IF;
  
  IF array_length(changed_fields, 1) > 0 THEN
    INSERT INTO audit_events (
      action, action_category, entity_type, entity_id,
      organization_id, changed_fields, source
    ) VALUES (
      'update', 'data_change', TG_TABLE_NAME, NEW.id,
      NEW.organization_id, changed_fields, 'trigger'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Fase 3 — Soft Delete

```sql
-- Adicionar deleted_at a tabelas críticas
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- RLS policies devem filtrar deleted_at IS NULL
-- Views existentes devem ser atualizadas
```

### Fase 4 — Depreciar Campos Redundantes

```
1. leads.stage → depreciar em favor de lead_stage_id
2. leads.interested_property_type_id → depreciar em favor de interested_property_type_ids
3. app_role 'desenvolvedor' → mapear para 'developer'
```

---

## 6. Plano de Reconciliação e Qualidade de Dados

### 6.1 Jobs de Consistência Recomendados

| Job | Frequência | SQL |
|-----|-----------|-----|
| Invoices pagas sem `paid_at` | Diário | `SELECT id FROM invoices WHERE status = 'pago' AND paid_at IS NULL` |
| Transactions pagas sem `paid_at` | Diário | `SELECT id FROM transactions WHERE paid = true AND paid_at IS NULL` |
| Contracts ativos com `end_date` no passado | Diário | `SELECT id FROM contracts WHERE status = 'ativo' AND end_date < now()` |
| Leads com `stage` divergente de `lead_stage_id` | Semanal | Cross-check entre enum e FK |
| Subscriptions expiradas não canceladas | Diário | `SELECT id FROM subscriptions WHERE current_period_end < now() AND status = 'active'` |
| Properties sem imagens | Semanal | `SELECT p.id FROM properties p LEFT JOIN property_images pi ON pi.property_id = p.id WHERE pi.id IS NULL` |
| Orphan property_images | Semanal | `SELECT pi.id FROM property_images pi LEFT JOIN properties p ON p.id = pi.property_id WHERE p.id IS NULL` |

### 6.2 Reconciliação com Provedores Externos

| Provedor | Reconciliação | Frequência |
|---------|--------------|-----------|
| Asaas | Comparar `subscriptions.status` com API Asaas | Semanal |
| Meta Ads | Comparar `ad_leads` count com Meta API | Semanal |
| R2/Cloudinary | Verificar URLs de imagens acessíveis | Mensal |

### 6.3 Métricas de Qualidade

| Métrica | SQL de Verificação |
|---------|-------------------|
| Leads sem telefone E sem email | `SELECT COUNT(*) FROM leads WHERE phone IS NULL AND email IS NULL AND is_active = true` |
| Properties sem preço | `SELECT COUNT(*) FROM properties WHERE sale_price IS NULL AND rent_price IS NULL AND status = 'disponivel'` |
| Contracts sem property_id | `SELECT COUNT(*) FROM contracts WHERE property_id IS NULL AND status = 'ativo'` |

---

## 7. Backlog Técnico Priorizado

```
FASE 1 — CONSTRAINTS E INTEGRIDADE (Semana 1-2, ~8h)
[ ] I3   UNIQUE(organization_id, code) em contracts .......... 0.5h [P0]
[ ] I4   Trigger validação datas contracts .................... 1h [P0]
[ ] I5   Trigger validação commissions ....................... 0.5h [P0]
[ ] I6   Trigger sync paid_at em invoices .................... 1h [P1]
[ ] I7   Trigger sync paid_at em transactions ................ 0.5h [P1]
[ ] I13  Trigger updated_at automático (tabelas críticas) .... 2h [P1]
[ ] I8   Trigger validação preço vs transaction_type ......... 1h [P2]
[ ]      Backfill: leads sem lead_stage_id ................... 1h [P1]

FASE 2 — AUDITORIA E RASTREABILIDADE (Semana 3-4, ~8h)
[ ] I16  Trigger audit_field_change em leads ................. 2h [P0]
[ ]      Trigger audit_field_change em contracts .............. 1h [P0]
[ ]      Trigger audit_field_change em commissions ............ 1h [P1]
[ ]      Trigger audit_field_change em subscriptions .......... 1h [P1]
[ ]      Trigger audit_field_change em profiles (role) ........ 1h [P1]
[ ]      Documentar campos deprecados (leads.stage, etc.) ..... 1h [P2]
[ ] I1   Backfill leads.lead_stage_id + deprecar stage ........ 1h [P2]

FASE 3 — SOFT DELETE E RETENÇÃO (Semana 5-6, ~8h)
[ ] I11  Adicionar deleted_at a leads, contracts, properties .. 2h [P1]
[ ]      Atualizar RLS para filtrar deleted_at IS NULL ........ 2h [P1]
[ ]      Atualizar queries do frontend ........................ 2h [P1]
[ ] I18  Política de retenção para logs (90d para ai_router_logs) 1h [P2]
[ ]      pg_cron job para purge de logs antigos ............... 1h [P2]

FASE 4 — SEGURANÇA DE DADOS (Semana 7-8, ~6h)
[ ] I10  Encrypt OAuth tokens (Meta, RD Station) .............. 4h [P1]
[ ]      Encrypt API keys (Imobzi, WhatsApp) .................. 2h [P1]

FASE 5 — RECONCILIAÇÃO (Semana 9-10, ~4h)
[ ]      Edge Function: data-quality-check (cron semanal) ..... 2h [P2]
[ ]      Edge Function: reconcile-billing (cron semanal) ...... 2h [P2]
```

**Total: ~34h em 10 semanas.**

---

## 8. Resumo Executivo

### O que está BOM ✅
- RLS habilitado em TODAS as tabelas
- `property_status_history` — bom padrão de auditoria de status
- Billing webhook logs com idempotência (`provider_event_id`)
- Import tracking granular (`import_runs` + `import_run_items`)
- Enums para estados críticos (contract_status, property_status, etc.)
- 13 índices de performance já implementados
- Views seguras (`ai_router_providers_safe`, `profiles_public`)

### O que PRECISA de atenção ❌
- Dual source of truth em leads (`stage` vs `lead_stage_id`)
- Zero CHECK/validation triggers em tabelas financeiras
- Auditoria depende do frontend (não do banco)
- OAuth tokens em texto plano
- Sem soft delete — deleção é irreversível
- Logs crescem indefinidamente
- `contracts.code` sem UNIQUE constraint

### Princípio guia para evolução
> **"Dados corretos no banco > validação no frontend."**
> Constraints e triggers são a última linha de defesa. O frontend pode ter bugs, ser bypassed por Edge Functions, ou ter race conditions. O banco deve garantir integridade independentemente de quem escreve.

---

*Auditoria gerada por análise do schema (types.ts) + queries ao banco de produção em 2026-03-23.*
