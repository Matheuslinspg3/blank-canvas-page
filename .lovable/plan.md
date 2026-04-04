

## Plano: Cache de Listagens Externas no Marketplace

### Conceito
Em vez de buscar nos portais (OLX, Viva Real) a cada pesquisa, o sistema salva os resultados em uma tabela `external_listings` que funciona como cache. Quando outro usuário faz a mesma busca, o sistema primeiro verifica o cache. Só busca nos portais novamente se o cache estiver expirado.

### Implementação

**1. Tabela `external_listings` (migração)**
- Campos: `id`, `source` (olx/vivareal/chavesnamao), `source_url`, `title`, `description`, `address_city`, `address_neighborhood`, `address_state`, `transaction_type`, `sale_price`, `rent_price`, `bedrooms`, `bathrooms`, `parking_spots`, `area_total`, `images` (text[]), `contact_phone`, `contact_name`, `created_at`, `updated_at`, `expires_at` (timestamp para controle de validade do cache)
- Índices em `address_city`, `transaction_type`, `expires_at`
- RLS: leitura pública para usuários autenticados

**2. Tabela `external_search_cache` (migração)**
- Campos: `id`, `search_hash` (hash MD5 dos filtros usados), `filters_json` (jsonb com os filtros originais), `listing_ids` (uuid[] referenciando external_listings), `fetched_at`, `expires_at`
- Lógica: ao pesquisar, gera hash dos filtros → se existe cache válido (ex: 6h), retorna direto. Senão, aciona o n8n.

**3. Edge Function `external-listings-sync`**
- Recebe filtros (cidade, tipo, quartos, etc.)
- Gera hash dos filtros e verifica `external_search_cache`
- Se cache válido: retorna listings do cache
- Se expirado/inexistente: chama webhook n8n passando os filtros → n8n scrapa os portais → insere em `external_listings` → atualiza `external_search_cache`
- Retorna os resultados

**4. Webhook n8n (configurado pelo usuário)**
- Recebe filtros da Edge Function
- Faz scraping nos portais
- Chama de volta a Edge Function ou insere direto no Supabase via API

**5. Frontend — Marketplace**
- Após carregar imóveis internos, chama `external-listings-sync` com os mesmos filtros
- Exibe resultados externos com badge do portal (OLX, Viva Real, etc.)
- Card externo mostra botão "Ver no portal" com link direto (`source_url`)
- Sem botão de contato interno — redireciona para o portal original

### Fluxo de Cache

```text
Usuário filtra "Praia Grande, 2 quartos, venda"
        │
        ▼
  Hash dos filtros → "abc123"
        │
        ▼
  external_search_cache tem "abc123" válido?
     ┌──YES──┐       ┌──NO──┐
     ▼       │       ▼      │
  Retorna    │   Chama n8n  │
  do cache   │   webhook    │
             │       │      │
             │       ▼      │
             │   Scrapa     │
             │   portais    │
             │       │      │
             │       ▼      │
             │   Salva em   │
             │   external_  │
             │   listings + │
             │   cache      │
             │       │      │
             └───────┴──────┘
                     │
                     ▼
            Exibe no Marketplace
            com badge do portal
```

### TTL do Cache
- Padrão: **6 horas** — configurável
- Job pg_cron opcional para limpar listings expirados (> 7 dias sem acesso)

### Arquivos a criar/editar
1. **Migração SQL** — tabelas `external_listings` + `external_search_cache` + RLS
2. **`supabase/functions/external-listings-sync/index.ts`** — Edge Function
3. **`src/hooks/useExternalListings.ts`** — hook React Query
4. **`src/components/marketplace/ExternalPropertyCard.tsx`** — card com badge do portal
5. **`src/pages/Marketplace.tsx`** — integrar resultados externos na listagem

