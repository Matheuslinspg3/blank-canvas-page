## Diagnóstico

`portocaicaraimoveis.com.br` (apex, sem www) trava no spinner do `TenantRouter`. O domínio resolve corretamente no banco, mas:

1. **Chain sequencial pesada**: `useTenantByHostname` → `useStorefrontByOrgId` (org → brand → website → properties) → `useSiteDocumentPublic` são 6 RPCs em cascata, gated por `org?.id`. Em rede lenta passa de 10s.
2. **Watchdog mal calibrado**: `TenantRouter` aborta em 10s e renderiza "Site não encontrado" mesmo quando a query JÁ resolveu — porque `notFound` é avaliado contra `organizationId` que pode ainda estar sendo refetchado.
3. **Refetch duplicado**: A query `get_public_tenant_by_domain` dispara 2x (StrictMode/refetchOnMount). Não causa erro, mas atrasa.
4. **Sem cache de hostname**: Toda visita refaz tudo do zero — não há `sessionStorage` para o mapeamento hostname → orgId.
5. **Properties bloqueando indiretamente**: 1000 imóveis carregam em paralelo (1.7s+) e chegam ao mesmo tempo dos blocos visuais, atrasando o paint do hero.
6. **Fluxo apex → www não-redireciona**: `get_public_tenant_redirect` está ligado a `platformSlug` apenas; domínios custom apex nunca redirecionam para www mesmo com `redirect_to_custom_domain=true` configurado.

## Correções

### 1. `src/hooks/useTenantByHostname.ts`
- Adicionar cache em `sessionStorage` (`tenant-cache:{hostname}` com TTL 30 min) — primeira render usa valor cacheado, evita spinner.
- Setar `refetchOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false` em todas as queries para eliminar o duplicado.
- Estender lógica de redirect para domínios custom também (apex → www) quando `redirect_to_custom_domain=true` e `custom_hostname` diferente do hostname atual.
- Garantir `notFound` só seja `true` quando `isFetched && !data && !isFetching`.

### 2. `src/components/TenantRouter.tsx`
- Aumentar watchdog para 20s.
- Quando o watchdog dispara, **não** mostrar "Site não encontrado" se a query ainda está em andamento — manter spinner com mensagem "Carregando site..." e botão "Tentar novamente".
- Só mostrar erro quando `notFound === true` (i.e. resposta veio sem dados) ou quando query realmente falhou.
- Hidratar org id do cache de sessionStorage para evitar flash de spinner em navegação interna.

### 3. `src/hooks/useStorefrontByOrgId.ts`
- Eliminar a chamada extra `get_public_org_by_id`: usar `organizationId` recebido como `org.id` e buscar `name`/`slug` em paralelo (não bloqueante para o render). Reduz 1 round-trip do critical path.
- Marcar `properties` query com `placeholderData: []` e remover do `isLoading` (já está, mas garantir que `WhiteLabelStorefront` não a aguarde — seções com lista de imóveis renderizam skeletons enquanto carrega).
- Aplicar `refetchOnWindowFocus: false` em todas.

### 4. `src/components/WhiteLabelStorefront.tsx`
- Trocar gating de `isLoading` para mostrar skeleton parcial ao invés de spinner full-screen depois que tenant já resolveu.
- Error boundary local (`StorefrontErrorBoundary`) com fallback que mostra nome da org + WhatsApp + mensagem amigável caso o renderer V2 quebre por layout corrompido.

### 5. `src/main.tsx` (queryClient)
- Definir defaults globais: `refetchOnWindowFocus: false`, `staleTime: 60_000` para evitar refetches espúrios em todo o app público (verificar se já não é o caso).

### 6. Guardrails contra falhas futuras
- **Timeout por query**: helper `withTimeout(promise, 8000)` em volta dos RPCs públicos críticos (`get_public_tenant_by_domain`, `get_public_org_by_slug`, `get_public_site_document_full`) — se demorar mais que 8s, falha rápido com erro tratável em vez de pendurar o spinner.
- **Health-check do layout V2**: validar `siteDoc.layout` contra um schema mínimo (`pages` array, `meta` object); se inválido, cair para o renderer legado (`StorefrontTemplateRenderer`) em vez de quebrar.
- **Telemetria**: log estruturado em Sentry quando watchdog dispara, incluindo hostname, query atual e tempo decorrido — para detectar regressões cedo.
- **SEO mínimo no HTML inicial**: injetar `<title>` e `<meta description>` genéricos em `index.html` para o caso do JS não carregar (não é a causa atual, mas evita "Lovable" como título no apex).

## Arquivos editados

- `src/hooks/useTenantByHostname.ts`
- `src/hooks/useStorefrontByOrgId.ts`
- `src/components/TenantRouter.tsx`
- `src/components/WhiteLabelStorefront.tsx` (+ novo `StorefrontErrorBoundary.tsx`)
- `src/lib/queryClient.ts` (defaults)
- `src/lib/withTimeout.ts` (novo helper)

## Validação

- Recarregar `https://portocaicaraimoveis.com.br/` — deve renderizar o site em <3s mesmo em mobile.
- Testar apex sem www — deve redirecionar para `www.portocaicaraimoveis.com.br` se configurado.
- Forçar layout corrompido (banco) — deve cair no fallback legado, não em tela branca.
- Simular timeout de RPC — deve mostrar erro amigável com retry, não spinner eterno.
