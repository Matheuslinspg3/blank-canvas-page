

## Diagnóstico — `TypeError: Importing a module script failed`

### Causa raiz mais provável (95% confiança)

**Stale client após deploy.** A versão atual em produção é `3.3.0.1`, mas `public/version.json` está em `3.3.0`. Quando um usuário com a aba aberta recebe um deploy novo:

1. O HTML antigo (já carregado) referencia chunks hashados antigos (ex: `vendor-react-abc123.js`)
2. O deploy substitui esses arquivos por novos hashes (`vendor-react-xyz789.js`)
3. Ao navegar para `/i/portocaicaraimoveis/1436` (rota lazy → `PropertyLandingPage`), o React tenta `import()` do chunk antigo
4. CDN/host retorna 404 ou HTML do SPA fallback → Safari iOS dispara `Importing a module script failed`

**Evidências no código:**
- `vite.config.ts` tem `manualChunks` com vendor splits → muitos chunks hashados
- `TenantRouter.tsx` usa `lazy(() => import("@/pages/PropertyLandingPage"))` na rota crítica `/imovel/:id`
- `App.tsx` provavelmente tem dezenas de rotas lazy
- `lazyRetry.ts` existe mas **nunca é usado** (`grep` mostra zero callers — confirmar)
- Service worker ativo em produção (Workbox), com `navigateFallbackDenylist` mas **sem tratamento de chunk stale**
- `version.json` desatualizado → polling de versão (se existir) não detecta deploy

### Problemas secundários encontrados

| # | Problema | Impacto |
|---|----------|---------|
| S1 | `lazyRetry.ts` existe mas não é importado em lugar nenhum | Retry morto |
| S2 | `PropertyLandingPage` lazy sem retry no `TenantRouter` | Tela branca em deploy |
| S3 | `LazyRichTextEditor`, `LazyMarkdown` usam `lazy()` cru | Mesma vulnerabilidade |
| S4 | `ErrorBoundary` global recarrega página sem guard anti-loop | Risco de loop infinito |
| S5 | Sentry `ignoreErrors` não inclui variantes do erro de chunk → polui ou perde contexto | Observabilidade ruim |
| S6 | Sem listener global `window.addEventListener("error", ...)` para `ChunkLoadError` / preload de CSS | Erros escapam do React |
| S7 | `version.json` desatualizado (3.3.0 vs APP_VERSION 3.3.0.1) | SW update routine não dispara corretamente |
| S8 | SW cacheia `/rest/v1/*` (NetworkFirst) mas não tem estratégia explícita para chunks JS hashados | Pode servir chunk antigo após deploy |
| S9 | `Suspense` fallbacks são genéricos (`Skeleton h-64`) — sem mensagem de erro se demorar muito | UX ruim em rede lenta |
| S10 | Nenhum boundary específico por rota — uma rota lazy quebrada derruba toda a SPA | Single point of failure |

---

## Plano de implementação

### 1. Novo utilitário `src/utils/lazyWithRetry.ts` (substitui `lazyRetry.ts`)

```ts
// - Detecta erros de chunk: "Importing a module script failed",
//   "Failed to fetch dynamically imported module", "Unable to preload CSS"
// - 2 retries com backoff (300ms, 800ms)
// - Em última instância: safeReloadOnce() com sessionStorage flag
// - Reporta ao Sentry com contexto: rota, retry count, online, SW status
// - Exporta: lazyWithRetry, isImportChunkError, safeReloadOnce
```

### 2. Novo `src/utils/safeReload.ts`

```ts
// safeReloadOnce(reason: string)
// - Lê sessionStorage["lov_reload_attempted"]
// - Se já recarregou nesta sessão+rota → NÃO recarrega, retorna false
// - Se offline → não recarrega, retorna false
// - Senão: marca flag com timestamp + rota, location.reload()
// - TTL de 5min para permitir nova tentativa em sessão longa
```

### 3. Novo `src/utils/chunkErrorDetection.ts`

```ts
// isImportChunkError(error): boolean
//   matches: /Importing a module script failed/i
//            /Failed to fetch dynamically imported module/i
//            /Unable to preload CSS/i
//            /error loading dynamically imported module/i
//            /ChunkLoadError/i
```

### 4. Novo `src/components/ChunkLoadErrorBoundary.tsx`

- Boundary específico que detecta erro de chunk via `isImportChunkError`
- Se for chunk error → tenta `safeReloadOnce("chunk_error_boundary")`
- Se já recarregou → mostra fallback amigável ("Nova versão disponível, clique para atualizar")
- Outros erros → re-throw para `Sentry.ErrorBoundary` global lidar

### 5. Listener global em `src/main.tsx`

```ts
// window.addEventListener("error", (e) => {
//   if (isImportChunkError(e.error || e.message)) {
//     Sentry.captureException(...) com contexto rico
//     safeReloadOnce("global_error_listener")
//   }
// })
// window.addEventListener("unhandledrejection", ...) // mesmo tratamento
// + vite:preloadError event listener (Vite 5 emite isso)
```

### 6. Aplicar `lazyWithRetry` nos pontos críticos

- `src/components/TenantRouter.tsx` → `PropertyLandingPage` (rota afetada `/i/...`)
- `src/components/editors/LazyRichTextEditor.tsx`
- `src/components/markdown/LazyMarkdown.tsx`
- `src/App.tsx` → mapear todas rotas lazy e converter (operação maior, listar antes de aplicar)

### 7. Melhorar `src/components/ErrorBoundary.tsx`

- Wrap com `ChunkLoadErrorBoundary` por dentro
- Adicionar tags Sentry: `route`, `release`, `online`, `connection.effectiveType`, `sw_active`, `display_mode`
- Botão "Tentar novamente" (reset boundary state) além de "Recarregar"
- Mensagem específica se `isImportChunkError(error)` → "Nova versão disponível"

### 8. Sentry — enriquecer `src/main.tsx`

```ts
// Sentry.init({
//   ...
//   ignoreErrors: [...existing,
//     // Não ignorar chunk errors — queremos vê-los, mas com contexto
//   ],
//   beforeSend(event, hint) {
//     const err = hint.originalException
//     if (isImportChunkError(err)) {
//       event.tags = { ...event.tags, chunk_error: true, route: location.pathname }
//       event.contexts = { ...event.contexts, runtime: {
//         online: navigator.onLine,
//         visibility: document.visibilityState,
//         connection: (navigator as any).connection?.effectiveType,
//         sw_controller: !!navigator.serviceWorker?.controller,
//       }}
//       // dedup: só envia 1 chunk error por sessão+rota
//       const key = `chunk_${location.pathname}`
//       if (sessionStorage.getItem(key)) return null
//       sessionStorage.setItem(key, "1")
//     }
//     return event
//   }
// })
```

### 9. Service Worker — ajuste em `vite.config.ts`

- Adicionar `globIgnores` para nada — chunks devem ser precached normalmente
- Adicionar runtime cache `NetworkFirst` para `*.js` e `*.css` com `networkTimeoutSeconds: 3` e fallback à cache (já que hashes mudam, garante busca de novo)
- Atualmente assets hashados ficam em precache e nunca são re-buscados → **problema confirmado**: quando um asset não está no precache (chunk novo após deploy parcial), SW não tem fallback

Correção: adicionar runtime caching para `/assets/*.{js,css}` com `StaleWhileRevalidate` + `cacheableResponse: { statuses: [200] }` (não cachear 404/HTML).

### 10. Atualizar `public/version.json`

- Sincronizar com `APP_VERSION` (3.3.0.1)
- Adicionar build time correto

### 11. `index.html` — meta cache hint

- Adicionar `<meta http-equiv="Cache-Control" content="no-cache">` no `<head>` (defesa em profundidade — host real deve enviar header também, mas usuário não controla totalmente)

---

## Arquivos alterados

**Novos:**
- `src/utils/lazyWithRetry.ts`
- `src/utils/safeReload.ts`
- `src/utils/chunkErrorDetection.ts`
- `src/components/ChunkLoadErrorBoundary.tsx`

**Modificados:**
- `src/main.tsx` (listeners globais + Sentry beforeSend)
- `src/components/ErrorBoundary.tsx` (mensagem chunk-aware, tags ricas, botão "Tentar novamente")
- `src/components/TenantRouter.tsx` (usa lazyWithRetry)
- `src/components/editors/LazyRichTextEditor.tsx` (usa lazyWithRetry)
- `src/components/markdown/LazyMarkdown.tsx` (usa lazyWithRetry)
- `src/App.tsx` (rotas lazy → lazyWithRetry — apenas se houver `lazy()` direto)
- `vite.config.ts` (runtime caching para JS/CSS)
- `public/version.json` (sync 3.3.0.1)
- `index.html` (meta cache-control no-cache)

**Deletado:**
- `src/utils/lazyRetry.ts` (substituído)

---

## Guard rails implementados

| Guard | Mecanismo |
|-------|-----------|
| Anti-loop reload | `sessionStorage["lov_reload_attempted"]` com TTL 5min + chave por rota |
| Anti-retry infinito | Máximo 2 retries com backoff fixo |
| Offline guard | `safeReloadOnce` checa `navigator.onLine` antes de recarregar |
| Sentry dedup | `beforeSend` descarta chunk errors duplicados na mesma sessão+rota |
| Falha graciosa | `ChunkLoadErrorBoundary` mostra UI de "atualização disponível" se reload já aconteceu |
| Boundary isolado | Componentes não críticos (markdown, editor) não derrubam página |

## Riscos remanescentes

1. **Cache do navegador externo** (proxy ISP, CDN intermediário) — fora do nosso controle. Mitigação: `Cache-Control` no host + meta no `index.html`.
2. **Se o servidor responder HTML para `/assets/*.js`** (SPA fallback mal configurado) — não conseguimos detectar pelo browser, só por inspeção do response. Adicionarei verificação no `lazyWithRetry`: se `error.message` contiver "Unexpected token '<'", reportar como `mime_mismatch`.
3. **Service Worker antigo ainda controlando a página** — `controllerchange` listener já existe em `main.tsx`, mantemos.

## Checklist de testes (manual)

- [ ] Em mobile Safari iOS, abrir `/i/portocaicaraimoveis/1436` após simular deploy (renomear chunk no devtools)
- [ ] Forçar offline → recarregar → não deve fazer reload em loop, mostra mensagem
- [ ] Ativar `Network throttling = Slow 3G` → Suspense fallback aparece, não erro
- [ ] DevTools → Application → Service Workers → Update on reload → testar
- [ ] Verificar Sentry: chunk error chega com tags `chunk_error: true`, `route`, `connection`

## Checklist deploy/infra

- [ ] Confirmar com host: `Cache-Control: no-cache, must-revalidate` para `index.html`
- [ ] Confirmar: `Cache-Control: public, max-age=31536000, immutable` para `/assets/*`
- [ ] Confirmar: `/assets/*.js` retorna `Content-Type: application/javascript` (nunca `text/html`)
- [ ] Sincronizar `version.json` em cada deploy (idealmente automatizar via script post-build)

