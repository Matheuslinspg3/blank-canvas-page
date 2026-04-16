

# Diagnóstico Completo e Plano de Correção — Leads Perdidos

## Causas raiz identificadas (3 problemas distintos)

### Problema 1: `website-lead` NÃO FOI DEPLOYED
O código no repositório está correto (`lead_stage_id`), mas a versão **em produção** ainda usa `stage_id`. Os logs confirmam:
```
"Could not find the 'stage_id' column of 'leads' in the schema cache"
```
Isso significa que **nenhum lead de formulário do site** entrou desde o último deploy que quebrou.

### Problema 2: `website-lead` usa `order_index` (coluna inexistente)
O código atual consulta `lead_stages` com `.order("order_index")`, mas a coluna real é `position`. Mesmo após deploy, a query de stage falharia silenciosamente (retornaria null, lead entraria sem stage — não fatal, mas incorreto).

### Problema 3: `rd-station-sync-leads` bloqueado por trigger de dedup
O trigger `trg_check_lead_duplicate` rejeita leads com phone ou email já existente na org. Leads do RD Station que já existiam como contatos manuais são bloqueados com `RAISE EXCEPTION`. Isso explica leads do RD Station não entrando.

## Impacto

- **website/site leads**: Zero entradas desde o fim de semana — todos falharam com erro 500
- **RD Station leads**: Parcialmente bloqueados pela dedup trigger (apenas leads novos passaram)
- **facebook/anuncio/manual**: Não afetados (inseridos via frontend/outras funções)

## Plano de correção

### 1. Deploy imediato de `website-lead` (já corrigido no repo)
Apenas deploiar. O código já tem `lead_stage_id` e `user_id` corretos.

### 2. Corrigir `order_index` → `position` em `website-lead`
Linha 33: `.order("order_index")` → `.order("position")`

### 3. Corrigir `order_index` → `position` em `create-site-lead`
Verificar se o mesmo bug existe nesta função (usada pelo site builder contact form).

### 4. Deploy de `create-site-lead` e `website-lead`

### 5. Recuperar leads perdidos
- Consultar logs de acesso ao endpoint `website-lead` dos últimos dias para identificar payloads
- Como os logs de request body não são persistidos pelo Supabase, a recuperação direta não é possível
- **Alternativa**: Verificar se há dados no RD Station, Meta Ads, ou analytics que possam indicar leads que tentaram se cadastrar
- Inserir um lead de teste para confirmar que o fluxo funciona

### 6. Tornar a dedup trigger mais tolerante para syncs
Em vez de `RAISE EXCEPTION`, fazer um `UPDATE` do lead existente (enriquecer dados) ou simplesmente retornar `NEW` com um log, para que syncs não percam dados silenciosamente. **Isto fica como melhoria futura** — o fix prioritário é o deploy.

## Arquivos alterados
1. `supabase/functions/website-lead/index.ts` — corrigir `order_index` → `position`
2. `supabase/functions/create-site-lead/index.ts` — verificar/corrigir mesmo problema
3. Deploy imediato de ambas as funções

## Validação pós-fix
- Chamar `website-lead` via curl com payload de teste
- Confirmar lead inserido no banco
- Confirmar que aparece no CRM

