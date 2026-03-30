

## Corrigir perda de dados no marketplace ao editar/duplicar imoveis

### Problemas identificados

1. **Marketplace nao sincroniza ao editar**: Quando um imovel publicado no marketplace e editado, os dados no `marketplace_properties` ficam desatualizados. O codigo so chama `publishToMarketplace` quando o checkbox e marcado explicitamente — e o checkbox reseta para `false` ao abrir o form (linha 246 do PropertyForm).

2. **`sale_price_financed` e `payment_options` nao existem na tabela `marketplace_properties`**: A tabela nao possui essas colunas. O `publishToMarketplace` (usePropertyBulkOps.ts linha 121-134) nao inclui esses campos no upsert. Mesmo que o imovel tenha esses dados no CRM, eles nunca chegam ao marketplace.

3. **Duplicacao nao afeta marketplace diretamente** — o imovel duplicado e novo e nao e publicado automaticamente, o que e correto. Porem o imovel ORIGINAL pode perder sincronizacao se o usuario editar apos duplicar.

---

### Solucao

#### 1. Migracao: adicionar colunas ao marketplace_properties

```sql
ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS sale_price_financed bigint,
  ADD COLUMN IF NOT EXISTS payment_options text[];
```

#### 2. Atualizar publishToMarketplace (usePropertyBulkOps.ts)

No upsert do `publishToMarketplace` (linha 121-134), adicionar os novos campos:

```ts
sale_price_financed: prop.sale_price_financed,
payment_options: (prop as any).payment_options || null,
```

Fazer o mesmo no `bulkPublishToMarketplace` (o trecho que monta o array de rows).

#### 3. Auto-sync ao editar imovel publicado (Properties.tsx)

No `executePropertySubmit`, apos o `updateProperty`, verificar se o imovel esta publicado no marketplace e re-sincronizar automaticamente:

```ts
// Apos updateProperty
if (editingProperty) {
  await updateProperty(editingProperty.id, data, images, ownerData);
  propertyId = editingProperty.id;
  // Auto-sync marketplace if published
  publishToMarketplace(editingProperty.id).catch(() => {});
}
```

Porem, para evitar publicar um imovel que NAO esta no marketplace, precisamos checar primeiro. A abordagem:

- Importar `useMarketplaceStatus` no Properties.tsx
- No `executePropertySubmit`, se `editingProperty` e `publishedIds.has(editingProperty.id)`, chamar `publishToMarketplace` automaticamente (fire-and-forget)
- Se o usuario tambem marcou o checkbox de publicar, nao duplicar a chamada

#### 4. Atualizar a view publica (se necessario)

Verificar se `marketplace_properties_public` precisa expor `sale_price_financed` e `payment_options` para consumidores. Se sim, atualizar a view.

---

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Nova migracao SQL | `ALTER TABLE` para adicionar `sale_price_financed` e `payment_options` |
| `src/hooks/usePropertyBulkOps.ts` | Incluir novos campos no upsert de publish e bulkPublish |
| `src/pages/Properties.tsx` | Importar `useMarketplaceStatus`, auto-sync marketplace ao editar imovel ja publicado |
| View `marketplace_properties_public` (migracao) | Adicionar as novas colunas se precisar exibi-las publicamente |

Nenhuma mudanca em logica de negocio existente — apenas adicao de campos e auto-sync.

