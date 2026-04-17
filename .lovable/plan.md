

## Plano — Número exclusivo para contato no Marketplace (corretor↔corretor)

### Contexto
Atualmente o Marketplace é interno (corretor↔corretor entre imobiliárias). O contato hoje sai do telefone da organização. O usuário quer um campo opcional **por imóvel** com um telefone específico para esse fluxo, sem interferir com:
- Landing pages públicas (que usam token do corretor → cliente final).
- Telefone público da organização.

### Design

**1 campo novo em `properties`:** `marketplace_contact_phone text NULL`
- Opcional. Se preenchido → é o número que aparece no card do Marketplace.
- Se vazio → fallback atual (telefone da org).
- **Não** afeta landing page, share links, leads do site público.

### Mudanças

**1. Migration**
```sql
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS marketplace_contact_phone text;

ALTER TABLE public.marketplace_properties
  ADD COLUMN IF NOT EXISTS marketplace_contact_phone text;
```
- Atualiza trigger `trg_sync_marketplace_on_property_update` para espelhar `marketplace_contact_phone`.
- Atualiza a view/função pública `marketplace_properties_public` para expor o campo.
- Trigger leve de sanitização: trim + valida formato (só dígitos, +, espaço, parênteses, hífen). Vazio vira NULL.

**2. Form de imóvel — `BasicTab.tsx` (ou nova seção em "Marketplace")**
Adicionar bloco condicional:
- Aparece apenas quando o usuário liga o toggle "Publicar no Marketplace".
- Campo `Input` rotulado **"Telefone para contato no Marketplace (opcional)"**.
- Helper text: *"Número que outros corretores verão. Se vazio, usaremos o telefone da imobiliária. Não afeta landing pages."*
- Máscara/validação BR (`(99) 99999-9999`).

**3. Hook `usePropertyCRUD.ts`**
- Incluir `marketplace_contact_phone` no payload de create/update.
- Tipo `PropertyFormData` ganha o campo opcional.

**4. Hook `usePropertyBulkOps.ts` — `publishToMarketplace`**
- Ao montar o registro a inserir em `marketplace_properties`, copiar `marketplace_contact_phone` da `properties`.

**5. UI Marketplace — card e modal de contato**
- `MarketplacePropertyCard` / botão "Falar com a imobiliária":
  - Resolução do número: `marketplace_contact_phone` → fallback `organizations.phone`.
  - Badge sutil "Contato direto do anúncio" quando vier do campo do imóvel.
- `useMarketplace` retorna o novo campo no select.

**6. Guardrails**
- Trigger `marketplace_require_contact` (já existe para org) ganha um relaxamento: se `marketplace_contact_phone` está preenchido no imóvel, **não** exige telefone na org. Garante que o publish não falha por causa de phone faltando se o imóvel já tem o seu próprio.
- Validação no front: regex BR; placeholder claro; trim antes do submit.
- Tooltip explicando que esse número **não** aparece em landing pages para clientes finais.

### Separação clara de canais
| Canal | Telefone exibido |
|---|---|
| Landing page `/i/...` (cliente final) | `broker_token` → captador → org |
| Marketplace interno (corretor↔corretor) | `properties.marketplace_contact_phone` → org |
| WhatsApp Agent | configuração própria do agente |

Sem cruzamento. Sem regressão nos fluxos atuais.

### Arquivos
- `supabase/migrations/<novo>.sql` — coluna em ambas tabelas, trigger sync, validação, ajuste em `marketplace_require_contact`.
- `src/integrations/supabase/types.ts` — auto regenerado.
- `src/components/properties/form/BasicTab.tsx` (ou nova `MarketplaceTab`) — campo + validação.
- `src/hooks/usePropertyCRUD.ts` — incluir campo no payload + tipos.
- `src/hooks/usePropertyBulkOps.ts` — propagar no `publishToMarketplace`.
- `src/hooks/useMarketplace.ts` — incluir no `select`.
- `src/components/marketplace/MarketplacePropertyCard.tsx` (e modal de contato) — usar fallback novo.

### Resultado
- Cada imóvel pode ter seu próprio número para o Marketplace, opcional.
- Não interfere com landing pages (continua tokens A/B/C → corretor específico).
- Fallback gracioso para telefone da org quando vazio.
- Trigger garante consistência marketplace↔properties.

