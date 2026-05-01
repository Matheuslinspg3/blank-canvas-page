## Objetivo

Corrigir o erro `TypeError: Cannot read properties of undefined (reading 'default')` na rota `/dashboard` do preview Lovable, causado por falha no `vite:preloadError` ao buscar `/assets/Dashboard-*.js`. A causa raiz é o ambiente de preview tentando registrar Service Worker e usar PWA, gerando cache agressivo e conflitos de versão. Vamos blindar PWA para rodar somente em produção real, sem quebrar `build:dev`, e melhorar a observabilidade no Sentry.

## Decisão sobre o conflito do `virtual:pwa-register/react`

Hoje `src/components/UpdateBanner.tsx` importa estaticamente `virtual:pwa-register/react` no topo. Se removêssemos o plugin `VitePWA` do array de plugins fora de produção, o módulo virtual deixaria de existir e o `build:dev` quebraria.

Vamos combinar **as duas defesas**:

1. **Opção preferida (Vite)**: manter o plugin no array, usando `VitePWA({ disable: mode !== "production", ... })`. Com `disable: true`, o plugin ainda registra o módulo virtual `virtual:pwa-register/react` (com hook no-op), mas não gera `sw.js`, manifest, nem injeta o registro de SW. `build:dev` continua passando.
2. **Defesa em profundidade (UI)**: isolar o uso do hook num subcomponente PWA-only montado somente quando `isPwaRuntimeEnabled === true`. Mesmo se o módulo virtual mudar de comportamento, o hook nunca executa em preview/iframe/dev.

## Alterações

### 1. Novo util `src/utils/runtimeEnvironment.ts`

Centraliza a detecção de ambiente. Exporta:

- `isPreviewHost` — hostname contém `id-preview--` ou `lovableproject.com`
- `isInIframe` — `window.self !== window.top` (try/catch para cross-origin)
- `isProductionBuild` — `import.meta.env.MODE === "production"`
- `isPwaRuntimeEnabled` — `isProductionBuild && !isInIframe && !isPreviewHost`
- `getServiceWorkerControllerState()` — retorna `controller?.state ?? "none"`

SSR-safe: cada leitura de `window` está guardada por `typeof window !== "undefined"`.

### 2. `vite.config.ts` — VitePWA com `disable` condicional

```ts
VitePWA({
  disable: mode !== "production",
  registerType: "autoUpdate",
  // ...resto inalterado
})
```

- O plugin permanece no array → módulo virtual `virtual:pwa-register/react` continua resolvido.
- Em `build:dev` / dev server: nada é gerado (sem `sw.js`, sem precache, sem injeção).
- Em produção: comportamento atual preservado.
- Manter `.filter(Boolean)`.

### 3. `src/components/UpdateBanner.tsx` — isolamento do hook

Refatorar em dois componentes no mesmo arquivo:

- `UpdateBanner` (default/named export atual): early-return `null` se `!isPwaRuntimeEnabled`. Quando habilitado, renderiza `<UpdateBannerInner />`.
- `UpdateBannerInner` (interno): contém todo o uso de `useRegisterSW` e `setInterval(registration.update, 30s)`.

Como o subcomponente só é montado quando `isPwaRuntimeEnabled` é `true`, o hook nunca é chamado em preview. O import no topo permanece (necessário porque o JSX referencia o hook), mas com `disable: true` no plugin, é um no-op.

### 4. `src/main.tsx` — usar o util e limpeza segura

- Substituir as checagens inline por imports do util.
- Quando `!isPwaRuntimeEnabled`:
  - `navigator.serviceWorker?.getRegistrations().then(r => r.forEach(reg => reg.unregister()))` (já existe).
  - **Adicionar** limpeza de caches: `caches?.keys().then(keys => keys.forEach(k => caches.delete(k)))`. Apenas neste branch — nunca em produção.
- Quando `isPwaRuntimeEnabled`: chamar `setupServiceWorkerUpdateRoutine()` como hoje.
- Enriquecer o handler global `vite:preloadError`: extrair `chunk_url` do payload (`(e as any).payload?.message` regex `/\/assets\/[^\s"']+\.js/`) e passar para `Sentry.captureException` via `extra`.

### 5. `src/utils/lazyWithRetry.ts` — telemetria + validação

- Aceitar `moduleName` (já aceita) e manter compat.
- Após resolver o módulo, validar:
  ```ts
  if (!result || typeof result !== "object" || !("default" in result) || !result.default) {
    throw new Error(`Module "${moduleName ?? "unknown"}" resolved without default export`);
  }
  ```
- Enriquecer `Sentry.captureException` com tags adicionais via util:
  - `hostname`, `is_preview_host`, `is_iframe`, `pwa_runtime_enabled`, `sw_controller`, `chunk_error`, `module_name`, `route`, `release` (`APP_VERSION`).
  - `extra`: `retry_attempt`, `chunk_url` (quando inferível da mensagem).

### 6. `src/utils/lazyRetry.ts` — shim com overload opcional

- Manter assinatura atual `lazyRetry(fn, retries?)` — não quebra as ~60 chamadas em `App.tsx`.
- Adicionar overload aceitando `lazyRetry(fn, { moduleName, retries? })` que delega ao `lazyWithRetry`.

### 7. `src/App.tsx` — `moduleName` em rotas críticas

Apenas 5 linhas alteradas:

- `Dashboard` → `lazyRetry(() => import("./pages/Dashboard"), { moduleName: "Dashboard" })`
- `CRM` → `{ moduleName: "CRM" }`
- `Properties` → `{ moduleName: "Properties" }`
- `Marketplace` → `{ moduleName: "Marketplace" }`
- `Financial` → `{ moduleName: "Financial" }`

### 8. Preservar comportamento atual

- `safeReloadOnce`, `hasReloadedThisSession`, `useVersionPolling`, `ChunkLoadErrorBoundary`: inalterados.
- `Dashboard.tsx`: nenhuma mudança (export default já correto).
- Banco, edge functions, planos, preços, UI funcional: nenhuma mudança.

## Resultado esperado

- Preview Lovable não tenta registrar SW → `[SW] Registration error: SecurityError` desaparece.
- Sem PWA em dev/preview, cache agressivo deixa de servir chunks `Dashboard-*.js` desatualizados → `Failed to fetch dynamically imported module` cai drasticamente.
- Quando ainda ocorrer (rede instável), `lazyWithRetry` faz 2 retentativas, `safeReloadOnce` recarrega 1x, e Sentry recebe contexto detalhado.
- `npm run build:dev` continua passando (módulo virtual resolvido pelo plugin com `disable: true`).
- Produção (`portadocorretor.com.br`, `portocaicaraimoveis.lovable.app`) continua com PWA ativo e banner de update funcionando.

## Arquivos alterados

- **novo**: `src/utils/runtimeEnvironment.ts`
- `vite.config.ts`
- `src/components/UpdateBanner.tsx`
- `src/main.tsx`
- `src/utils/lazyWithRetry.ts`
- `src/utils/lazyRetry.ts`
- `src/App.tsx` (5 linhas)

## Validação

- `tsc --noEmit` (build automático).
- Confirmar que `vite build --mode development` completa sem erros e sem gerar `dist/sw.js`.
- Console do preview: ausência de `[SW] Registration error`.
- `navigator.serviceWorker.getRegistrations()` retorna `[]` no preview após reload.
- Em produção publicada, validar que `UpdateBanner` ainda registra SW e exibe quando há nova versão.