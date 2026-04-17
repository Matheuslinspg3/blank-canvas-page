

## Diagnóstico — Landing pública `/i/:orgSlug/:propertyCode` quebra para deslogados

### Causa raiz
**Conflito de rotas + acesso direto a tabelas com RLS.** Em `src/App.tsx`:
- L179: `/i/:orgSlug/:propertyCode` → `PropertyLandingPage` ← ganha (vem antes)
- L183: `/i/:orgSlug/:code` → `PublicPropertyBySlug` ← morto, nunca matcha

`PropertyLandingPage` resolve `orgSlug→orgId→propertyId` indo **direto nas tabelas** (linhas 205-212):
```ts
supabase.from("organizations").select("id").eq("slug", orgSlug)
supabase.from("properties").select("id").eq("organization_id", org.id).eq("property_code", ...)
```
RLS de `organizations` exige `is_member_of_org(id)` e `properties` exige membership → **anônimo recebe `null` em ambas** → `resolvedId=null` → "Imóvel não encontrado".

Confirmado no DB: org `portocaicaraimoveis` existe, imóvel `1557` existe e está `disponivel`. RPCs `SECURITY DEFINER` adequadas já existem (`get_public_property_by_org_code`, `get_public_org_by_slug`, `get_public_property`).

### Bugs secundários encontrados
1. **Rota duplicada** `/i/:orgSlug/:propertyCode` (179) e `/i/:orgSlug/:code` (183) — segunda nunca executa.
2. **`PropertyLandingPage` não suporta busca por código sem login**, mesmo que o `useLandingContent`/`useLandingOverrides` rodem com RLS (precisam de IDs corretos).
3. **Faltam guardrails** para detectar regressões: nenhum log/telemetria quando a resolução falha.
4. **SEO/OG** quebra também: bots crawlers (WhatsApp/Facebook) batem na mesma rota e veem "Imóvel não encontrado".

### Solução

**1. Corrigir rotas em `src/App.tsx`**
- Remover linha 183 (duplicada e morta).
- Manter `/i/:orgSlug/:propertyCode` e `/i/:orgSlug/:propertyCode/:brokerToken` apontando para `PropertyLandingPage` (mantém atribuição via token e overrides).
- `/i/:slug` (legacy) continua em `PublicPropertyBySlug`.

**2. Refatorar resolução em `PropertyLandingPage` (linhas 200-216)**

Cadeia de fallbacks (3 camadas):
```
[Camada A] RPC pública get_public_property_by_org_code(orgSlug, code)
   ↳ retorna o objeto inteiro (property+images+broker) já público
   ↳ extrai property.id e popula state — pula re-fetch
   
[Camada B] Se A falhar → RPC get_public_org_by_slug(orgSlug)
   ↳ obtém orgId
   ↳ chama supabase.rpc('get_property_id_by_org_code', { org_id, code })
   ↳ usa esse id no fluxo atual (get_public_property)

[Camada C] Se B falhar → Se usuário ESTÁ logado, tenta from('properties') 
            (mantém comportamento legado para previews internos)

Se todas falharem → tela "Imóvel não encontrado" com botão "Tentar novamente" + link p/ home
```

**3. Nova RPC pública `get_property_id_by_org_code`**
Pequena, retorna apenas `uuid`, usada como fallback enxuto:
```sql
CREATE FUNCTION public.get_property_id_by_org_code(p_org_slug text, p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id FROM properties p
  JOIN organizations o ON o.id = p.organization_id
  WHERE o.slug = p_org_slug AND p.property_code = p_code
    AND p.status = 'disponivel'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_property_id_by_org_code(text,text) TO anon, authenticated;
```

**4. Otimização: usar dados da camada A direto**
Quando `get_public_property_by_org_code` resolve, o JSON já traz tudo (property+images+broker+media). Hidrata o estado sem precisar de outras chamadas. Reduz 4 round-trips para 1.

**5. Guardrails (evitar regressão)**

a. **Lint de rotas** — comentário no `App.tsx` marcando o bloco `/i/...` como crítico, com TODO de teste E2E.

b. **Telemetria silenciosa** — quando todas as camadas falharem, dispara `console.warn` estruturado + chama edge function `track-landing-visit` com flag `not_found=true` (já existe a fn, só estender). Permite alarme se a taxa de 404 subir.

c. **Teste de fumaça** — script Deno em `supabase/functions/_tests/landing-public-access.test.ts` que faz fetch anônimo de `/i/portocaicaraimoveis/1557` e valida que NÃO retorna o estado not_found. Roda a cada deploy.

d. **RLS guardrail no resolver** — a nova RPC só retorna se `status='disponivel'` (alinhada com `get_public_property`), evitando vazamento de imóveis arquivados.

e. **Comentário JSDoc** em `PropertyLandingPage` documentando: "NUNCA usar `supabase.from('organizations'/'properties')` no resolver — RLS bloqueia anônimo. Sempre RPC pública."

**6. SEO/OG bot fallback**
A `og-metadata` edge function já cobre crawlers, mas a URL canônica gerada por `usePropertyPublicUrl` aponta para `/i/...` direto. Sem mudança aqui — os crawlers continuam indo para `og-metadata`, e usuários reais agora terão a página funcional.

### Arquivos

- `src/App.tsx` — remover linha 183 duplicada.
- `src/pages/PropertyLandingPage.tsx` — refatorar `useEffect` de resolução (linhas 200-216) com cadeia A→B→C; hidratar estado direto quando A resolve.
- `supabase/migrations/<novo>.sql` — `get_property_id_by_org_code` + GRANT anon/authenticated.
- `supabase/functions/track-landing-visit/index.ts` — aceitar `not_found:boolean` opcional para telemetria.
- `supabase/functions/_tests/landing-public-access.test.ts` (novo) — smoke test E2E anônimo.

### Resultado
- Link `/i/portocaicaraimoveis/1557` abre normal sem login.
- 3 camadas de fallback impedem que uma única falha quebre tudo.
- Smoke test detecta regressões no deploy.
- Telemetria alerta se taxa de 404 subir.
- Crawlers continuam recebendo OG metadata correto.

