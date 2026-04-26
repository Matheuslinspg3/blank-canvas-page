# Ajustes Finais — Fase 2

Aplicar somente 2 ajustes pequenos e isolados. Sem migrations, sem RPC, sem Fase 3.

## Ajuste 1 — Factory `createDefaultPropertyFilters()`

**Arquivo:** `src/hooks/usePropertyFilters.ts`

- Criar `export function createDefaultPropertyFilters(): PropertyFilters` retornando um objeto novo com todos os campos atuais de `defaultFilters` (incluindo arrays `neighborhoods: []`, `cities: []`, `amenities: []` recriados a cada chamada).
- Substituir o `defaultFilters` atual por:
  ```ts
  export const defaultFilters: PropertyFilters = Object.freeze(createDefaultPropertyFilters()) as PropertyFilters;
  ```
  Mantendo compatibilidade com consumidores read-only.
- Atualizar usos internos no hook:
  - `useState<PropertyFilters>(() => ({ ...createDefaultPropertyFilters(), ...parsedFromUrl }))` na inicialização.
  - `clearFilters` → `setFilters(createDefaultPropertyFilters())`.

**Arquivo:** `src/components/owners/OwnerDetails.tsx`

- Trocar `import { defaultFilters, ... }` por `import { createDefaultPropertyFilters, ... }`.
- No `useMemo` do `localFilters`, usar `...createDefaultPropertyFilters()` em vez de `...defaultFilters`.

## Ajuste 2 — Rota de edição `?edit=true`

**Arquivo:** `src/components/owners/OwnerPropertyListItem.tsx`

- Trocar `goTo(\`/imoveis/${property.id}?edit=1\`)` por `goTo(\`/imoveis/${property.id}?edit=true\`)`.

## Validação

- `npx tsc --noEmit`
- `npx vite build`
- Corrigir qualquer erro antes de concluir.

## Entregáveis

- Arquivos alterados
- Confirmação da factory `createDefaultPropertyFilters()` e do `Object.freeze` no `defaultFilters`
- Confirmação da rota `?edit=true`
- Resultado do typecheck e do build

## Fora de escopo

Migrations, alterações na RPC, Fase 3, dashboard, configurações, alertas, notificações ou automações.