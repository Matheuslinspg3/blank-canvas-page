

# Otimização do Porta do Corretor

## Estado Atual

O sistema tem ~89K LOC frontend, 73+ Edge Functions, 311 componentes, e custos fixos de ~R$240/mês. Os audits existentes (`AUDITORIA_VELOCIDADE_ENTREGA.md` e `AUDITORIA_CUSTOS_TOTAIS.md`) já mapeiam os gargalos. Abaixo está um resumo priorizado do que otimizar.

---

## 1. Performance (Impacto direto no usuário)

| Problema | Solução | Esforço |
|----------|---------|---------|
| Leads sem paginação (trava com >300) | Paginar por estágio no Kanban | Alto |
| Dashboard faz 4 queries separadas | RPC `compute_financial_summary()` — 1 query | Baixo |
| God Hooks (useProperties 930 linhas) | Quebrar em usePropertyCRUD + Images + Owners | Médio |
| useLeads 551 linhas | Quebrar em useLeadCRUD + Kanban + BulkOps | Médio |

## 2. Segurança (Risco real)

| Problema | Solução | Esforço |
|----------|---------|---------|
| CORS `*` em 70+ functions | Allowlist de domínios | Médio |
| Race condition em generateCode() | RPC `generate_contract_code()` com lock | Baixo |
| Deleção parcial de imóvel | RPC `delete_property_cascade()` | Baixo |
| Sem plan limits | Trigger que rejeita INSERT acima do limite | Baixo |

## 3. Custo de Desenvolvimento (DX)

| Problema | Solução | Esforço |
|----------|---------|---------|
| 73 functions com auth/CORS duplicado | `_shared/auth.ts`, `cors.ts`, `response.ts` | Médio |
| 5 testes para 89K LOC | Testes para useLeads, useProperties, useContracts | Médio |
| Arquivos >700 linhas (9 arquivos) | Regra de max 500 linhas, split Settings/GeradorAnuncios | Médio |
| Sem seed para dev local | `seed-dev-data.sql` | Baixo |

## 4. Custo Financeiro

| Problema | Solução | Economia |
|----------|---------|----------|
| 3 storage providers simultâneos | Finalizar migração R2, remover Cloudinary | ~$5/mês + 3 functions a menos |
| IA sem cache em alguns endpoints | Já parcialmente feito (summarize-lead) | ~80% chamadas |
| VPS WhatsApp R$90/mês (38% do fixo) | Avaliar UAZAPI Cloud no médio prazo | R$40-60/mês |
| ai_router_logs sem TTL | Verificar pg_cron ativo para cleanup | Previne billing extra |

## 5. Ordem de Execução Recomendada

```text
SEMANA 1 — Quick Wins (~10h)
├── RPC generate_contract_code() com lock
├── RPC delete_property_cascade()
├── Plan limits enforcement (trigger)
├── _shared/ modules para Edge Functions
└── Seed script para dev

SEMANA 2 — Modularização (~12h)
├── Quebrar useProperties → 3 hooks
├── Quebrar useLeads → 3 hooks
└── Split Settings.tsx em 5 sub-componentes

SEMANA 3-4 — Escala (~14h)
├── Paginar leads por estágio
├── RPC compute_financial_summary()
├── Split GeradorAnuncios.tsx e PropertyDetails.tsx
└── CORS allowlist

SEMANA 5-6 — Estrutura (~12h)
├── Reorganizar src/modules/ por domínio
├── Feature flags (tabela + hook)
├── Testes para hooks e Edge Functions críticas
└── Finalizar migração R2
```

## Resumo

O custo de infra é saudável (R$240/mês). O maior gasto é **~8h/mês de tempo de dev** perdido em complexidade acidental. As otimizações P0-P1 (~8h de implementação) eliminam ~4h/mês de retrabalho — ROI positivo em 2 meses.

