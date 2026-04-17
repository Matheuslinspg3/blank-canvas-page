

## Diagnóstico — Toggle Marketplace bugado ao editar imóvel

### Causa principal — toggle nunca lê o estado real
`PropertyForm.tsx` linha **246**: `setPublishToMarketplace(false)` em todo reset, sem consultar se o imóvel já está em `marketplace_properties`. Resultado: ao abrir "Editar", o switch sempre aparece **desligado**, mesmo para imóveis publicados.

### Causa secundária — desligar o toggle não despublica, mas o usuário não sabe
O toggle em modo edição não tem semântica clara:
- **OFF + publicado** → roda **auto-resync** (re-upsert silencioso, linha 544 `Properties.tsx`).
- **ON + publicado** → roda publish (upsert idêntico).
- **OFF para despublicar** → não existe. Não há ação de remover.

O usuário "ativa" achando que vai publicar, salva, e aí entra a próxima causa.

### Causa terciária — status muda → some do marketplace
`useMarketplace.ts` linha **50**: lista só `status='disponivel'`. O publish reupserta `status` da tabela `properties`. Se o usuário editou status para qualquer outra coisa (reservado, inativo, etc.) durante a mesma edição, o imóvel é "publicado" mas com status filtrado → **desaparece da listagem** e dá impressão de "saiu do marketplace".

### Causas adicionais
- `publishToMarketplace(...).catch(() => {})` em `Properties.tsx` (518, 545, 553) e `PropertyDetails.tsx` (184, 188) **engole todo erro**. Se o trigger `marketplace_require_contact` rejeita (sem telefone na org), o usuário recebe toast de "salvo" e nada explica o sumiço.
- Cache `publishedIds` (`useMarketplaceStatus`) tem `staleTime: 30s` — pode estar desatualizado quando o form abre.
- `useMarketplaceStatus` baixa **todos** os IDs publicados sem filtrar por org → lento e desnecessário.

---

## Solução

### 1. Toggle reflete estado real (PropertyForm.tsx)
Receber `isPublished: boolean` como prop e inicializar `publishToMarketplace = isPublished` no reset. Renomear para 3 estados visualmente claros:
- Switch **"Publicado no Marketplace"** com tooltip explicando "ligar = publica/atualiza, desligar = remove do Marketplace".

### 2. Semântica explícita: ON publica, OFF despublica
`executePropertySubmit` (Properties.tsx) e `handleFormSubmit` (PropertyDetails.tsx):
```
const wasPublished = publishedIds.has(id);
if (publishMarketplace && !wasPublished) → publish (insert)
if (publishMarketplace && wasPublished)  → publish (re-sync)
if (!publishMarketplace && wasPublished) → hideFromMarketplace (delete) — com confirm dialog
if (!publishMarketplace && !wasPublished) → no-op
```
Adicionar `hideFromMarketplace(id: string)` (single) ao `usePropertyBulkOps` reaproveitando a mesma rota.

### 3. Tratar erros de publish (não usar `.catch(() => {})`)
Trocar para `await` real dentro de `executePropertySubmit`, com try/catch que mostra toast de erro com a mensagem do trigger ("Cadastre o telefone público da imobiliária…"). Manter o save da propriedade mesmo se publish falhar, mas avisar.

### 4. Aviso ao mudar status para não-disponível enquanto publicado
No `handleSubmit` do form: se `isPublished && data.status !== 'disponivel'`, abrir confirm:
> "Este imóvel está no Marketplace. Mudar status para '{status}' vai escondê-lo da listagem pública. Continuar?"

### 5. Guardrails

**a) Banco — sincronizar status ao atualizar `properties`**
Trigger `AFTER UPDATE ON properties` que, se existe linha em `marketplace_properties` para esse id, atualiza apenas os campos espelhados (status, title, prices, etc.). Garante que o marketplace nunca fica defasado nem inconsistente — independente do frontend.

**b) Banco — view de health check**
`vw_marketplace_status_drift`: lista imóveis onde `properties.updated_at > marketplace_properties.updated_at` (já existe a query, virar view).

**c) UI — badge no card do imóvel**
Mostrar selo "No Marketplace" no `PropertyCard` quando `publishedIds.has(id)`, eliminando ambiguidade visual.

**d) Cache mais fresco**
`useMarketplaceStatus` filtrando por `organization_id` + invalidar ao abrir form de edição (refetch on mount).

### Arquivos
- `src/components/properties/PropertyForm.tsx` — prop `isPublished`, init correto, tooltip.
- `src/pages/Properties.tsx` + `src/pages/PropertyDetails.tsx` — passar `isPublished`, lógica ON/OFF explícita, await publish, confirm de status.
- `src/hooks/usePropertyBulkOps.ts` — exportar `hideFromMarketplace` (single id).
- `src/hooks/useProperties.ts` — repassar `hideFromMarketplace`.
- `src/hooks/useMarketplaceStatus.ts` — filtrar por org, exportar `refetch`.
- `src/components/properties/PropertyCard.tsx` (ou equivalente) — badge "No Marketplace".
- `supabase/migrations/<novo>.sql` — trigger `properties → marketplace_properties` sync + view `vw_marketplace_status_drift`.

### Resultado
- Toggle mostra estado real ao editar.
- Ligar publica, desligar despublica (com confirm).
- Mudança de status emite alerta antes de "esconder" o imóvel.
- Erros do publish viram toasts visíveis (trigger de telefone faltando, etc.).
- Trigger de banco mantém marketplace sempre sincronizado, mesmo se UI esquecer.

