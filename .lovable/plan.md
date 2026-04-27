# Origem padrão do telefone do Marketplace por organização

Aprovado. Implementação aditiva, sem backfill, sem alterar imóveis existentes, sem tocar em `get_marketplace_contact`, `MarketplacePropertyCard`, `ContactDialog` ou landing pages.

## 1. Migration (aditiva, idempotente)

`supabase/migrations/<ts>_org_default_marketplace_phone_source.sql`

- `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS marketplace_default_contact_phone_source text NOT NULL DEFAULT 'organization'`.
- Trigger `validate_org_marketplace_default_phone_source` (BEFORE INSERT/UPDATE OF a coluna) — normaliza para lower/trim e bloqueia qualquer valor que não seja `organization` ou `owner`. `custom` rejeitado nesta fase.
- Zero `UPDATE` em `properties` / `marketplace_properties`.

## 2. Hook novo

`src/hooks/useOrgMarketplaceDefaults.ts`
- React Query, `staleTime: 5 min`.
- Retorna `{ defaultSource: 'organization' | 'owner', isLoading, isFetched, refetch }`.
- Fail-soft para `'organization'` em caso de erro.

## 3. PropertyForm.tsx — carregamento assíncrono seguro

- Importar `useOrgMarketplaceDefaults`.
- Em `DEFAULT_VALUES` manter `"organization"` como fallback estático.
- No `useEffect` de reset:
  - **Editando imóvel**: continua exatamente como hoje (preserva `property.marketplace_contact_phone_source`). Nunca sobrescrever.
  - **Novo imóvel** (`prefillData` ou nenhum): usar `defaultSource` do hook se já tiver carregado; caso contrário, manter `"organization"`.
- Adicionar segundo `useEffect` que **só dispara quando `!property` E `isFetched` E o usuário ainda não mexeu** no campo (`!form.formState.dirtyFields.marketplace_contact_phone_source`): faz `form.setValue('marketplace_contact_phone_source', defaultSource, { shouldDirty: false })`. Isso garante que se o hook resolver depois do reset, o form novo absorve o default sem prender em "organization", e nunca pisa em escolha do usuário ou em valor de imóvel existente.

## 4. BasicTab.tsx — texto indicativo

- Consumir `useOrgMarketplaceDefaults`.
- Abaixo do RadioGroup (dentro do bloco `publishToMarketplace`), texto pequeno em `text-muted-foreground`:
  - `Padrão da imobiliária: Número do proprietário` ou
  - `Padrão da imobiliária: Número da imobiliária`.
- Radio individual continua editável.

## 5. usePropertyCRUD.ts — fallback no insert

No `createProperty.mutationFn`, antes do `insert`:
- Se `propertyData.marketplace_contact_phone_source` for falsy (não informado): buscar `organizations.marketplace_default_contact_phone_source` e aplicar (`owner` ou `organization`). Se o payload já trouxer valor explícito, respeita.
- Aplica também a importações/cadastro rápido que reutilizam essa mutation.
- Duplicação / `BatchVariationsDialog` / `usePropertyBatchCreate`: mantém `source` copiado do imóvel base (sem mudança).

## 6. SettingsCompanyTab.tsx — Card "Marketplace"

Novo Card abaixo de "Dados da Empresa" e acima de `PropertyReviewSettingsCard`:

- Título: **Marketplace**.
- Campo: **Telefone padrão dos imóveis no Marketplace**.
- RadioGroup com 2 opções:
  - **Número da imobiliária** — "Novos imóveis publicados no Marketplace usarão o telefone público da imobiliária por padrão."
  - **Número do proprietário** — "Novos imóveis publicados no Marketplace usarão o telefone do proprietário primário por padrão. A publicação será bloqueada se o imóvel não tiver proprietário com telefone válido."
- Quando `owner` selecionado, alerta amarelo:
  - "Ao usar esta opção, o telefone do proprietário poderá ficar visível para outros corretores no Marketplace nos imóveis publicados."
- Carrega/salva via `supabase.from('organizations').select/update`.
- `disabled={!canEditCompany}` (admin/sub_admin/leader/developer editam; demais leem).
- Após salvar, `queryClient.invalidateQueries({ queryKey: ['org-marketplace-defaults', orgId] })`.

## 7. Regra de prioridade (final)

```text
source efetivo do imóvel:
  1. properties.marketplace_contact_phone_source salvo (NUNCA sobrescrever em edição)
  2. payload explícito vindo do fluxo de criação/import
  3. organizations.marketplace_default_contact_phone_source
  4. fallback: 'organization'
```

## 8. O que NÃO muda

- Triggers de validação de publicação (organization/owner/custom): intactos.
- `get_marketplace_contact` RPC, `MarketplacePropertyCard`, `ContactDialog`, landing pages, contato público para cliente final: intactos.
- Limpeza `marketplace_contact_phone = null` quando `source !== 'custom'`: intacta.
- `BatchVariationsDialog` / `usePropertyBatchCreate`: source do imóvel base preservado.
- Imóveis existentes da Porto Caiçara: zero `UPDATE`.

## 9. Caso Porto Caiçara

Após deploy, em **Configurações → Empresa → Card Marketplace**, escolher **Número do proprietário** para `organization_id = cdf3f0e6-da64-4090-bc76-1758796bea28`. Apenas novos imóveis nascem com `owner`. Existentes ficam como estão.

## 10. Entregáveis

- Arquivos criados:
  - `supabase/migrations/<ts>_org_default_marketplace_phone_source.sql`
  - `src/hooks/useOrgMarketplaceDefaults.ts`
- Arquivos editados:
  - `src/components/properties/PropertyForm.tsx`
  - `src/components/properties/form/BasicTab.tsx`
  - `src/hooks/usePropertyCRUD.ts`
  - `src/components/settings/SettingsCompanyTab.tsx`
- Local na UI: **Configurações → Empresa → Card "Marketplace"**.
- `npx tsc --noEmit` e `npx vite build` rodados após implementação.
- Checklist manual:
  1. Org com default `organization` → novo imóvel nasce `organization`.
  2. Mudar default para `owner` → novo imóvel nasce `owner` (mesmo se o hook resolver após o reset inicial — ver §3).
  3. Editar imóvel existente: `source` salvo é mantido, mesmo se diferente do default.
  4. Publicar novo com `owner` sem proprietário válido → bloqueio do trigger atual.
  5. Duplicar imóvel: source do original preservado.
  6. Corretor comum: card visível em modo leitura.
  7. Tentar gravar `custom`/`xyz` via SQL na coluna org: trigger rejeita.
  8. Imóveis antigos da Porto Caiçara: `marketplace_contact_phone_source` inalterado.
