# 📊 Auditoria de Integridade de Dados — Pós-Migração
> **Data**: 2026-03-20 | **Banco**: `zpajuxxsxrwuqregdzjm`  
> **Escopo**: Contagens, órfãos, FKs, duplicidades, nulls, timestamps, consistência relacional

---

## 📋 INVENTÁRIO DE REGISTROS

### Tabelas com dados (27 tabelas populadas)

| # | Tabela | Registros | Criticidade |
|---|--------|-----------|-------------|
| 1 | rd_station_webhook_logs | 40.845 | Baixa (logs) |
| 2 | property_images | 25.548 | Alta |
| 3 | activity_log | 18.075 | Média (logs) |
| 4 | notifications | 3.355 | Média |
| 5 | audit_events | 1.604 | Média (logs) |
| 6 | leads | 1.467 | **Crítica** |
| 7 | properties | 1.122 | **Crítica** |
| 8 | marketplace_properties | 954 | Alta |
| 9 | property_owners | 932 | Média |
| 10 | lead_interactions | 492 | Alta |
| 11 | owners | 189 | Média |
| 12 | lead_score_events | 164 | Baixa |
| 13 | owner_aliases | 133 | Baixa |
| 14 | property_landing_content | 128 | Média |
| 15 | appointments | 120 | Alta |
| 16 | ai_usage_logs | 65 | Baixa |
| 17 | support_tickets | 40 | Baixa |
| 18 | ticket_messages | 31 | Baixa |
| 19 | lead_stages | 19 | **Crítica** |
| 20 | property_types | 13 | **Crítica** |
| 21 | maintenance_audit_log | 11 | Baixa |
| 22 | profiles | 10 | **Crítica** |
| 23 | user_roles | 10 | **Crítica** |
| 24 | user_devices | 8 | Baixa |
| 25 | lead_types | 7 | Alta |
| 26 | organizations | 3 | **Crítica** |
| 27 | app_runtime_config | 1 | **Crítica** |

### Tabelas vazias relevantes (62 tabelas)

| Tabela | Esperado vazio? | Risco |
|--------|----------------|-------|
| contracts | ⚠️ Verificar com origem | Médio |
| tasks | ⚠️ Verificar com origem | Baixo |
| transactions | ⚠️ Verificar com origem | Médio |
| subscription_plans | 🔴 **Precisa dados seed** | Alto |
| subscriptions | ⚠️ Depende de billing | Alto |
| admin_allowlist | ⚠️ Devs sem super-admin | Médio |
| brand_settings | ⚠️ Sem branding configurado | Baixo |
| organization_invites | ✅ Normal (convites são temporários) | — |
| import_runs | ✅ Normal | — |

---

## 🔴 ACHADOS CRÍTICOS

### ACH-1: Organizações faltantes (dados órfãos)

**Problema**: O banco possui apenas **3 organizações**, mas leads, properties e images referenciam **4 organizações que NÃO existem**.

| Org ID ausente | Leads órfãos | Properties órfãs | Impacto |
|----------------|-------------|------------------|---------|
| `fd75cd4a-5321-481d-a34b-87ee879e775c` | 731 | 141 | 🔴 Crítico |
| `11604e91-836f-4d52-baa5-2444c5281673` | 1 | 4 | 🟡 Médio |
| `14005d35-56b0-4b77-89bf-d7bdd56cb55f` | 1 | 0 | 🟡 Baixo |
| `8ac78cbc-840a-43aa-b41b-fcd7e9a36f37` | 1 | 0 | 🟡 Baixo |
| **Total** | **734** | **145** | |

**Causa**: A migração importou dados de tabelas (leads, properties, images) mas **não importou todas as organizations** do projeto original. Dados de orgs que não existiam no destino ficaram órfãos.

**Impacto**: 
- 734 leads (50% do total!) não pertencem a nenhuma org existente
- 145 properties (13% do total!) não pertencem a nenhuma org existente
- RLS filtra por `organization_id` → esses dados são **invisíveis** para todos os usuários
- Não causam erro, mas representam dados "fantasma" no banco

**Correção**: 
1. Se essas orgs DEVEM existir → importar as organizações faltantes
2. Se esses dados são de teste → deletar os registros órfãos
3. Se devem pertencer a org existente → atualizar organization_id

### ACH-2: 12.708 property_images órfãs

**Problema**: 12.708 imagens (50% do total de 25.548) apontam para 660 properties que **não existem no banco**.

**Causa**: Mesma que ACH-1 — properties de orgs faltantes foram parcialmente importadas, mas images de properties não importadas ficaram no banco.

**Impacto**: Dados invisíveis, espaço em disco desperdiçado. Sem erro funcional.

### ACH-3: 297 leads com broker de outra organização

**Problema**: 297 leads (da org `fd75cd4a-*` que não existe) têm `broker_id` apontando para corretores da org `cdf3f0e6-*` (Porto Caiçara).

**Causa**: Dados do projeto original onde essas orgs possivelmente eram a mesma ou tinham relação. No novo banco, a org fonte não existe, gerando o mismatch.

**Impacto**: Se esses leads fossem visíveis (não são, pois a org não existe), haveria cross-tenant data leak. Como a org não existe, RLS bloqueia acesso → **sem risco de segurança ativo**.

---

## ✅ ACHADOS POSITIVOS

| Verificação | Resultado | Status |
|-------------|----------|--------|
| Perfis duplicados | 0 | ✅ |
| Roles duplicadas | 0 | ✅ |
| Leads com nome NULL | 0 | ✅ |
| Leads com org NULL | 0 | ✅ |
| Properties com org NULL | 0 | ✅ |
| Properties sem código | 0 | ✅ |
| Profiles sem org | 0 | ✅ |
| Profiles sem nome | 0 | ✅ |
| Images sem URL | 0 | ✅ |
| Orgs sem nome | 0 | ✅ |
| Timestamps futuros | 0 | ✅ |
| Timestamps muito antigos | 0 | ✅ |
| Appointments velhos sem completar | 0 | ✅ |
| Notificações não lidas >90d | 0 | ✅ |
| profiles ↔ auth.users | 0 órfãos | ✅ |
| roles ↔ profiles | 0 órfãos | ✅ |
| interactions ↔ leads | 0 órfãos | ✅ |
| notifications ↔ profiles | 0 órfãos | ✅ |
| appointments ↔ leads | 0 órfãos | ✅ |
| contracts ↔ properties | 0 órfãos | ✅ |
| contracts ↔ leads | 0 órfãos | ✅ |
| commissions ↔ contracts | 0 órfãos | ✅ |
| invoices ↔ contracts | 0 órfãos | ✅ |

---

## 📐 METODOLOGIA DE CONFERÊNCIA

### 1. Priorização de tabelas

| Tier | Tabelas | Critério |
|------|---------|----------|
| **T1 — Crítica** | organizations, profiles, user_roles, auth.users | Base do multi-tenant e auth |
| **T2 — Core** | properties, leads, lead_stages, property_types, property_images | Dados de negócio principal |
| **T3 — Operacional** | appointments, contracts, commissions, transactions, invoices | Fluxos transacionais |
| **T4 — Suporte** | notifications, activity_log, audit_events | Logs e notificações |
| **T5 — Integração** | ad_*, imobzi_*, rd_station_*, import_* | Dados de integrações externas |

### 2. Diferenciando problema estrutural vs carga de dados

| Tipo | Exemplo | Como detectar | Correção |
|------|---------|---------------|----------|
| **Estrutural** | Coluna ausente, FK inválida, tipo errado | `information_schema`, pg_constraint | Migration SQL |
| **Carga** | Registros órfãos, dados de org inexistente | LEFT JOIN + WHERE IS NULL | Import adicional ou cleanup |
| **Configuração** | subscription_plans vazio, admin_allowlist vazio | count(*) = 0 em tabelas seed | INSERT de dados seed |

### 3. Como detectar: problema de estrutura vs carga

```
Se o erro é "column does not exist" → ESTRUTURAL
Se o erro é "0 rows returned" → CARGA ou RLS
Se o erro é "foreign key violation" → CARGA (dado referencia algo inexistente)
Se funciona mas dados estão errados → CARGA
Se funciona mas falta funcionalidade → ESTRUTURAL (trigger/function ausente)
```

---

## 🔍 SQLs DE DIAGNÓSTICO REUTILIZÁVEIS

### Dashboard de saúde (executar periodicamente)

```sql
SELECT 
  'auth_profile_sync' as metric,
  (SELECT count(*) FROM auth.users) as auth_users,
  (SELECT count(*) FROM profiles) as profiles,
  (SELECT count(*) FROM auth.users u LEFT JOIN profiles p ON u.id = p.user_id WHERE p.user_id IS NULL) as orphan_auth,
  (SELECT count(*) FROM profiles p LEFT JOIN auth.users u ON p.user_id = u.id WHERE u.id IS NULL) as orphan_profiles;
```

### Detectar registros apontando para orgs inexistentes

```sql
SELECT 'leads' as table_name, count(*) as orphans
FROM leads l LEFT JOIN organizations o ON l.organization_id = o.id WHERE o.id IS NULL
UNION ALL
SELECT 'properties', count(*)
FROM properties p LEFT JOIN organizations o ON p.organization_id = o.id WHERE o.id IS NULL
UNION ALL
SELECT 'property_images', count(*)
FROM property_images pi LEFT JOIN properties p ON pi.property_id = p.id WHERE p.id IS NULL;
```

### Verificar consistência cross-tenant

```sql
SELECT l.id as lead_id, l.name, l.organization_id as lead_org, p.organization_id as broker_org
FROM leads l 
JOIN profiles p ON l.broker_id = p.user_id 
WHERE l.organization_id != p.organization_id 
LIMIT 20;
```

### Relatório de tabelas seed vazias

```sql
SELECT 'subscription_plans' as table_name, count(*) as cnt FROM subscription_plans
UNION ALL SELECT 'admin_allowlist', count(*) FROM admin_allowlist
UNION ALL SELECT 'brand_settings', count(*) FROM brand_settings
UNION ALL SELECT 'transaction_categories', count(*) FROM transaction_categories
ORDER BY cnt;
```

---

## 📊 SCORE DE SAÚDE DO BANCO

### Critérios de pontuação (0-100)

| Categoria | Peso | Critério | Pontuação máx |
|-----------|------|----------|---------------|
| **Integridade auth** | 20% | auth.users ↔ profiles ↔ roles sem órfãos | 20 |
| **Integridade FKs** | 20% | FKs principais sem registros órfãos | 20 |
| **Completude de dados** | 15% | Tabelas core populadas, sem nulls indevidos | 15 |
| **Consistência temporal** | 10% | Sem timestamps futuros ou impossíveis | 10 |
| **Duplicidades** | 10% | Sem registros duplicados em tabelas chave | 10 |
| **Dados seed** | 10% | Tabelas de configuração populadas | 10 |
| **Isolamento tenant** | 10% | Sem cross-org data leaks | 10 |
| **Limpeza** | 5% | Sem dados fantasma ou órfãos significativos | 5 |

### Cálculo

| Categoria | Pontos obtidos | Máximo | Justificativa |
|-----------|---------------|--------|---------------|
| Integridade auth | **20** | 20 | 10/10 perfeito, 0 órfãos |
| Integridade FKs | **12** | 20 | -8: 734 leads + 145 props + 12.708 images órfãos |
| Completude de dados | **14** | 15 | -1: 0 nulls indevidos, mas contracts/tasks/transactions vazios |
| Consistência temporal | **10** | 10 | 0 problemas |
| Duplicidades | **10** | 10 | 0 duplicados |
| Dados seed | **5** | 10 | -5: subscription_plans e admin_allowlist vazios |
| Isolamento tenant | **8** | 10 | -2: 297 leads com broker cross-org (inativo mas presente) |
| Limpeza | **1** | 5 | -4: ~13.500 registros órfãos de orgs inexistentes |

### **SCORE FINAL: 80/100** 🟡

---

## ✅ VEREDITO

### Dados das 3 orgs existentes: **ÍNTEGROS** ✅
Para as organizações `Porto Caiçara`, `Teste Corretor` e `aaaaaaa`, todos os dados estão corretos, sem órfãos, duplicidades ou inconsistências.

### Dados de orgs migradas parcialmente: **ÓRFÃOS** 🔴
734 leads, 145 properties e 12.708 images pertencem a 4 organizações que **não existem** neste banco. Esses dados são invisíveis via RLS e não causam erros, mas ocupam espaço e poluem consultas administrativas.

### Recomendações prioritárias

| # | Ação | Impacto no score | Esforço |
|---|------|-----------------|---------|
| 1 | Importar as 4 orgs faltantes (se dados são válidos) | +12 pontos | Médio |
| 2 | OU limpar registros órfãos (se são dados de teste) | +12 pontos | Baixo |
| 3 | Seed de `subscription_plans` | +3 pontos | Baixo |
| 4 | Seed de `admin_allowlist` com emails dev | +2 pontos | Baixo |
| 5 | Verificar se contracts/tasks devem ter dados | +1 ponto | Verificação |

**Score potencial após correções: 92-96/100** ✅
