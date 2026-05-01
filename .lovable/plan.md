## Implementação final aprovada

### 1. Migração idempotente (`supabase/migrations/<ts>_increase_share_link_slug_size.sql`)
```sql
DO $$
DECLARE
  current_len int;
BEGIN
  SELECT character_maximum_length
    INTO current_len
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'property_share_links'
     AND column_name  = 'slug';

  IF current_len IS NULL OR current_len < 120 THEN
    ALTER TABLE public.property_share_links
      ALTER COLUMN slug TYPE varchar(120);
  END IF;
END
$$;
```

### 2. `src/hooks/useShareLink.ts` (refator completo)

Tipo:
```ts
export type ShareLinkResult = {
  link: string;
  usedFallback: boolean;
  reason?:
    | "broker-without-phone"
    | "missing-data"
    | "insert-failed"
    | "rls-insert-denied"
    | "share-link-slug-too-long"
    | "share-link-unique-conflict";
};
```

Mapa de tratamento:

| Código / condição | Retorno | Toast |
|---|---|---|
| Sem login / sem org | `null` | "Erro" / "Você precisa estar logado." |
| Sem orgSlug ou propertyCode | `null` | "Erro" / "Não foi possível gerar o link." |
| Reuso de registro existente | `{ link: base+"/"+token, usedFallback: false }` | (silencioso) |
| Insert OK com token | `{ link: base+"/"+token, usedFallback: false }` | (silencioso) |
| Insert OK sem broker_token | `{ link: base, usedFallback: true, reason: "insert-failed" }` | (silencioso, será coberto pelo consumidor) |
| `23514` ou texto telefone/phone | `{ link: base, usedFallback: true, reason: "broker-without-phone" }` | "Telefone obrigatório" / "Cadastre seu telefone..." |
| `22001` slug grande | `{ link: base, usedFallback: true, reason: "share-link-slug-too-long" }` | "Identificador muito longo" / "Usando link público." |
| `23505` conflito unique | `{ link: base, usedFallback: true, reason: "share-link-unique-conflict" }` | "Link já existente" / "Usando link público." |
| `42501` ou "row-level security" | `null` | "Sem permissão" / "Você não tem permissão..." |
| **Outro erro de insert** | `null` | "Falha ao criar link seguro" / "Não foi possível criar o token do corretor para este imóvel." |

Outros detalhes:
- `base = ${window.location.origin}/i/${orgSlug}/${propertyCode}` calculado antes do insert.
- Slug truncado em 120 chars.
- `console.error(...)` em todo erro com objeto completo (`code`, `message`, `details`, `hint`).

### 3. `src/pages/PropertyDetails.tsx`

Adaptar `handleCopyLink` e `handleShare`:
```ts
const result = await generateShareLink(id);
if (!result) return;            // toast já mostrado pelo hook
const url = result.link;
await navigator.clipboard.writeText(url);
if (!result.usedFallback) {
  toast({ title: "Link seguro copiado!", description: "..." });
}
// share/clipboard segue normal
```

### 4. Não tocado
- `usePropertyPublicUrl` / "Abrir Landing Page".
- Trigger `trg_share_link_require_phone`.
- RLS, marketplace-metrics, publicação no marketplace, dados do proprietário.
