# Origem configurável do telefone do Marketplace — Plano Final

Implementação aditiva e idempotente. Mantém `marketplace_contact_phone`. Não altera landing pages, card público de cliente final, regras de plano/RLS/paginação do Marketplace.

---

## 1) Migration (nova, idempotente)

Arquivo: `supabase/migrations/<ts>_marketplace_contact_phone_source.sql`

### 1.1 Coluna `marketplace_contact_phone_source`
- `properties.marketplace_contact_phone_source text NOT NULL DEFAULT 'organization'`
- `marketplace_properties.marketplace_contact_phone_source text NOT NULL DEFAULT 'organization'`
- CHECK em ambas: valores aceitos `'organization' | 'owner' | 'custom'` (drop+create por nome para idempotência).

### 1.2 Backfill (UPDATE one-shot, safe re-run)
- `marketplace_contact_phone` preenchido & não-vazio + source ainda no default `'organization'` ⇒ `source = 'custom'`.
- Caso contrário permanece `'organization'`.
- Aplicado tanto em `properties` quanto em `marketplace_properties`.

### 1.3 Trigger consolidado de sanitização + domínio (`trg_00_*`)
Função `public.sanitize_marketplace_contact_source()` (SET search_path = public):
- Normaliza `source` (lowercase, default `'organization'` se NULL; rejeita valores fora do enum).
- Trim em `marketplace_contact_phone`; vazio ⇒ NULL.
- **Regra-chave:** se `source != 'custom'` ⇒ `marketplace_contact_phone := NULL` (limpa telefone manual antigo).
- Se `source = 'custom'` e telefone presente ⇒ valida regex `^[0-9+()\-\s]{8,20}$`.

Triggers (drop antigos `trg_sanitize_marketplace_contact_phone_*` + cria com nomes ordenados):
- `trg_00_sanitize_marketplace_contact_source_props` BEFORE INSERT/UPDATE OF (phone, source) em `properties`.
- `trg_00_sanitize_marketplace_contact_source_mp` BEFORE INSERT/UPDATE OF (phone, source) em `marketplace_properties`.

### 1.4 Trigger de validação de publicação (`trg_10_*`) — só dispara em INSERT em `marketplace_properties`
Função `public.trg_marketplace_require_contact()`:
- `source = 'custom'`: exige `marketplace_contact_phone` válido (≥8 dígitos sanitizado).
- `source = 'owner'`: exige proprietário primário com `phone` válido (consulta `property_owners` JOIN `owners`, fallback `marketplace_properties.owner_phone` legado).
- `source = 'organization'`: exige `organizations.phone` válido OU pelo menos 1 `profile.phone` da org.
- Caso contrário ⇒ `RAISE EXCEPTION` com mensagem amigável.
- Drop antigo `marketplace_require_contact`; cria `trg_10_marketplace_require_contact` BEFORE INSERT.

> Resultado: só bloqueia quando `publish_to_marketplace = true` (porque a app só insere em `marketplace_properties` nesse caso). Salvar rascunho em `properties` com qualquer source continua permitido.

### 1.5 Sync trigger `properties → marketplace_properties`
Atualiza `sync_marketplace_on_property_update()` para também copiar `marketplace_contact_phone_source` no UPDATE.
WHEN clause inclui `OLD.marketplace_contact_phone_source IS DISTINCT FROM NEW.marketplace_contact_phone_source` para garantir propagação.

### 1.6 Listagem pública (`marketplace_properties_public` + `get_marketplace_properties_public()`)
- Recria função e view incluindo `marketplace_contact_phone_source`.
- **Não expõe** `owner_phone` cru. Mantém `marketplace_contact_phone` na listagem para compat (pode ser NULL para `source != 'custom'`).
- Telefone resolvido continua exclusivamente via RPC `get_marketplace_contact`.

### 1.7 RPC `get_marketplace_contact(p_property_id)` reescrita
Resolve por `source`:
- `custom`: usa `marketplace_contact_phone`. Se ausente ⇒ fallback para org.phone, status `'fallback'` ou `'missing'`.
- `owner`: usa telefone do proprietário primário. Se ausente ⇒ fallback para org.phone, status `'fallback'`. Importante: nunca devolve telefone da imobiliária com label de proprietário.
- `organization`: usa `organizations.phone` (com fallback para profile admin/sub_admin).

Retorno JSON inclui:
- **NOVO canônico**: `marketplace_contact_source`, `resolved_marketplace_contact_phone`, `resolved_marketplace_contact_label`, `contact_resolution_status` (`'ok' | 'fallback' | 'missing'`).
- **Compat (legado)**: `org_phone` e `marketplace_contact_phone` apontam para o telefone resolvido. Comentário explícito no SQL avisando que `org_phone` é legado e que, se algum componente futuro precisar do telefone real da imobiliária, deve usar um campo separado (`organization_phone`).
- **Não vaza**: `owner_phone` retorna `NULL`.
- Mantém `org_name`, `org_email`, `org_logo`, `broker_*`, `owner_name`.

Labels:
- `organization` → "Telefone da imobiliária"
- `owner`        → "Telefone do proprietário"
- `custom`       → "Contato direto do anúncio"

GRANT EXECUTE para `anon, authenticated` (mantido).

---

## 2) Frontend

### 2.1 `src/components/properties/PropertyForm.tsx`
- Adiciona ao schema Zod: `marketplace_contact_phone_source: z.enum(['organization','owner','custom']).default('organization')`.
- DEFAULT_VALUES: `marketplace_contact_phone_source: 'organization'`.
- Reset com base no imóvel: usa `(property as any).marketplace_contact_phone_source ?? (legacy phone ? 'custom' : 'organization')`.
- Em `handleSubmit`: se `source !== 'custom'`, força `marketplace_contact_phone = null` no payload (defesa em profundidade; trigger também faz).
- Encaminha o source no objeto `propertyData`.

### 2.2 `src/components/properties/form/BasicTab.tsx`
- Substitui o input solto por um `RadioGroup` com 3 cards (já temos `radio-group.tsx`).
- Props extra opcionais: `organizationPhone?: string | null`, `ownerPhone?: string | null` (vêm via `useAuth`/lookup leve no `PropertyForm`).
- Card 1 — `'organization'` (default): mostra "Número da imobiliária — &lt;telefone&gt;" ou aviso "Imobiliária sem telefone público cadastrado".
- Card 2 — `'owner'`: mostra "Número do proprietário — &lt;telefone&gt;". Se ausente ⇒ disabled + aviso "Proprietário sem telefone cadastrado". Inclui aviso de privacidade: "Ao selecionar esta opção, o telefone do proprietário ficará visível para outros corretores no Marketplace."
- Card 3 — `'custom'`: ao selecionar, mostra `Input` com máscara (mantém o input atual). Validação client: não-vazio quando selecionado.
- Quando o source carregado for `'owner'` mas o telefone não existir mais, **não desmarca**: deixa selecionado, mostra alerta inline.
- Mantém o texto informativo: "Número que outros corretores verão no card deste imóvel no Marketplace. Não afeta landing pages nem o contato exibido para clientes finais."

### 2.3 `src/components/marketplace/MarketplacePropertyCard.tsx`
Lógica de badge baseada em `property.marketplace_contact_phone_source`:
- `'owner'`  → badge "Contato do proprietário".
- `'custom'` → badge "Contato direto do anúncio" (mantém atual quando phone existe).
- `'organization'` → sem badge.
- Remove a checagem antiga `property.marketplace_contact_phone &&` para badge — agora é por source.

### 2.4 `src/components/marketplace/ContactDialog.tsx`
- Atualiza `ContactData` para incluir `marketplace_contact_source`, `resolved_marketplace_contact_phone`, `resolved_marketplace_contact_label`, `contact_resolution_status`.
- Acima do telefone exibido, mostra `resolved_marketplace_contact_label` ("Telefone da imobiliária" / "Telefone do proprietário" / "Contato direto do anúncio").
- Se `contact_resolution_status === 'fallback'` e source original era `'owner'`: mostra alerta "Telefone do proprietário indisponível — usando contato da imobiliária."
- Mantém botões de WhatsApp/copiar com o telefone resolvido (`org_phone` continua = resolvido).

### 2.5 Hooks/Tipos
- `src/hooks/useMarketplace.ts`: tipo `MarketplaceProperty` ganha `marketplace_contact_phone_source: 'organization' | 'owner' | 'custom' | null`. SELECT inclui a coluna.
- `src/hooks/usePropertyCRUD.ts`: SELECT inclui `marketplace_contact_phone_source`.
- `src/hooks/usePropertyBulkOps.ts`: ao publicar (`upsert` em `marketplace_properties`), inclui `marketplace_contact_phone_source: prop.marketplace_contact_phone_source ?? 'organization'`.
- `src/lib/validatePropertyColumns.ts`: adiciona `'marketplace_contact_phone_source'` ao whitelist.

### 2.6 Tipos do Supabase
- Não editamos `src/integrations/supabase/types.ts` manualmente (proibido). Usamos `as any` onde necessário até regen automática.

---

## 3) Lógica final resumida

| source         | salvo em properties | publicação válida quando…                              | `marketplace_contact_phone` armazenado | Telefone exibido no Marketplace                | Badge no card             | Label no diálogo            |
|----------------|---------------------|--------------------------------------------------------|----------------------------------------|------------------------------------------------|---------------------------|-----------------------------|
| `organization` | sempre              | org.phone ≥ 8 dígitos OU profile.phone existe          | NULL (limpo)                           | telefone real da imobiliária                   | (sem badge)               | "Telefone da imobiliária"   |
| `owner`        | sempre              | proprietário primário tem phone ≥ 8 dígitos            | NULL (limpo)                           | telefone do proprietário (ou fallback p/ org)  | "Contato do proprietário" | "Telefone do proprietário"* |
| `custom`       | sempre              | `marketplace_contact_phone` ≥ 8 dígitos válido         | preservado                             | `marketplace_contact_phone`                    | "Contato direto do anúncio" | "Contato direto do anúncio" |

\* Se o telefone do proprietário foi removido depois da publicação, `contact_resolution_status = 'fallback'` aciona aviso no diálogo: "Telefone do proprietário indisponível — usando contato da imobiliária."

Validação só corre quando o app insere em `marketplace_properties` (i.e., `publish_to_marketplace = true`). Salvar rascunho em `properties` com qualquer source nunca é bloqueado.

---

## 4) Não alterado
- Landing pages (`src/pages/Landing*`, `property_share_links`): não consomem a RPC nem o source.
- Card público de cliente final / `vw_landing_links_without_contact`: intacto.
- RLS de `marketplace_properties`, `properties`, plano/feature gating, paginação, filtros do Marketplace.

---

## 5) Validação automatizada
- `npx tsc --noEmit` (deve passar).
- `npx vite build` (deve passar).

## 6) Checklist manual
- [ ] Imóvel novo é criado com `source = 'organization'`.
- [ ] Imóvel legado com `marketplace_contact_phone` preenchido aparece com `source = 'custom'` selecionado e o telefone no campo.
- [ ] Imóvel legado sem telefone manual aparece com `source = 'organization'`.
- [ ] Trocar de `custom` → `organization` ou `owner` limpa `marketplace_contact_phone` (DB).
- [ ] Publicar com `owner` sem telefone ⇒ trigger bloqueia com mensagem clara.
- [ ] Publicar com `organization` sem telefone da imobiliária ⇒ trigger bloqueia.
- [ ] Publicar com `custom` vazio ⇒ trigger bloqueia.
- [ ] Imóvel já publicado: trocar source ⇒ `marketplace_properties` sincroniza (sync trigger).
- [ ] Card do Marketplace mostra badge correto por source (none / owner / custom).
- [ ] ContactDialog mostra label correto e telefone resolvido.
- [ ] `source = 'owner'` com proprietário sem telefone exibe aviso de fallback no diálogo (não publicável, mas se já estava publicado, não quebra).
- [ ] Listagem pública não expõe `owner_phone` cru.
- [ ] Landing pages e card público para cliente final inalterados.
- [ ] `tsc` e `vite build` limpos.
