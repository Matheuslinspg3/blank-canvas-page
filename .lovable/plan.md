

## Diagnóstico — "Contato indisponível" no Marketplace

### Causa principal — função RPC quebrada
`get_marketplace_contact(p_property_id)` retorna apenas:
```
org_name, org_phone, org_email, owner_name, owner_phone
```
Mas o frontend (`ContactDialog.tsx` l.18-28) espera:
```
org_name, org_phone, org_email, org_logo,
broker_name, broker_phone, broker_avatar,
owner_name, owner_phone
```
Resultado: `broker_name`/`broker_phone`/`org_logo` chegam **sempre `undefined`**. Como o componente prioriza o telefone do corretor (`brokerPhone`), e ele nunca existe, sobra só o `org_phone` — que também está NULL para 4/4 organizações com imóveis publicados.

### Causa secundária — telefones vazios no banco
Dados reais (consulta agora):
- **4 organizações** com 526 imóveis no marketplace → **0 com `phone` preenchido**.
- **7 profiles** dessas orgs → apenas **1 com `phone`**.
- 974 imóveis (de 1.480 marketplace) **nem têm linha em `properties`** (importação só populou `marketplace_properties`), então não dá para resgatar contato via `properties.captador_id`.

Quando ambos (`org.phone` e `broker.phone`) faltam, o dialog cai no "Dados de contato não disponíveis".

### Causas terciárias
- A RPC faz `JOIN profiles ON p.user_id = o.created_by` — se o owner da org não tiver `phone`, vira NULL silencioso. Não tenta o `captador_id` do imóvel, nem qualquer profile com `phone` da org como fallback.
- Não há validação no formulário de organização exigindo telefone.
- Não há aviso visual ao admin de que a org está publicando no marketplace sem contato.

---

## Solução

### 1. Reescrever `get_marketplace_contact` (migration)
A função passa a:
1. Buscar `marketplace_properties` + `organizations` (com `logo_url`).
2. Tentar resolver corretor responsável via `properties.captador_id` (quando a linha em `properties` existir).
3. Aplicar **fallback em cascata** para o telefone:
   `properties.captador.phone` → `properties.created_by.phone` → qualquer profile admin/owner da org com phone → `organizations.phone`.
4. Retornar todos os campos esperados pelo frontend (`broker_name`, `broker_phone`, `broker_avatar`, `org_logo`, etc.).

### 2. Backfill imediato dos telefones faltantes
Painel admin (ou script único) para preencher `organizations.phone` das 4 orgs ativas — sem isso a RPC não tem o que mostrar.

### 3. Mensagem mais útil quando realmente não há contato
Em `ContactDialog.tsx`, quando `hasAnyData=false`:
- Mostrar `org_name`/`org_logo` mesmo sem telefone.
- Texto: "Esta imobiliária ainda não cadastrou contato público. [Notificar imobiliária]" (envio de e-mail interno opcional).
- Logar evento em `marketplace_contact_intents` com `target_phone=null` para a org saber.

### 4. Guardrails (preventivos)

**a) Trigger no banco** — bloquear publicação no marketplace sem contato resolvível:
```sql
CREATE FUNCTION trg_marketplace_require_contact() RETURNS trigger ...
-- ao INSERT em marketplace_properties, garantir que
-- organizations.phone IS NOT NULL OR existe profile da org com phone
```
Erro amigável: "Cadastre o telefone da imobiliária antes de publicar no Marketplace."

**b) UI** — validação no `OrganizationSettings`:
- Campo "Telefone público" obrigatório (com máscara BR e `^\d{10,13}$`).
- Banner persistente no dashboard se org tem imóveis no marketplace e `phone IS NULL`.

**c) Health check** — view `vw_marketplace_orgs_missing_contact` + alerta no painel admin global.

**d) Teste de contrato** — Deno test que invoca `get_marketplace_contact` e valida que o JSON contém **todas** as chaves esperadas, prevenindo regressão silenciosa entre RPC e frontend.

### Arquivos
- `supabase/migrations/<novo>.sql` — nova RPC + trigger guard + view de health check.
- `src/components/marketplace/ContactDialog.tsx` — fallback visual + CTA "notificar imobiliária".
- `src/pages/Settings.tsx` (ou `OrganizationSettingsTab`) — campo telefone obrigatório + banner.
- `supabase/functions/get-marketplace-contact_test.ts` — teste de contrato (opcional mas recomendado).

### Resultado esperado
- Imóveis com `properties.captador_id` preenchido passam a mostrar telefone do corretor.
- Demais caem no telefone da org assim que o backfill rodar.
- Novas publicações ficam bloqueadas se não houver telefone — bug não volta.

