

## Plano — Landing Page única por imóvel, múltiplos corretores via token

### Princípio
- **1 imóvel = 1 landing page** (conteúdo IA gerado uma só vez, custo compartilhado).
- **N corretores** podem ter seu próprio link de compartilhamento desse mesmo imóvel.
- Cada link injeta o contato do corretor que o gerou, sem duplicar a página.

### Arquitetura

**URL:** `/i/{org-slug}/{property-code}/{broker-token}`
- Sem token → fallback (captador → created_by → admin org → telefone org).
- Com token → contato do corretor dono daquele link.

### Mudanças

**1. Migration — `property_share_links`**
```sql
ALTER TABLE property_share_links
  ADD COLUMN IF NOT EXISTS broker_token text UNIQUE;

UPDATE property_share_links
SET broker_token = 'b' || substr(md5(id::text), 1, 7)
WHERE broker_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_share_links_token_active
  ON property_share_links(broker_token) WHERE active = true;
```
- Já há UNIQUE `(property_id, broker_id)` ativo via lógica do hook → cada corretor tem **um** token estável por imóvel. Reusar se existir.

**2. RPC pública `get_landing_contact(p_property_id uuid, p_broker_token text)`**
- Se token válido + ativo → retorna profile do `broker_id` daquele share link.
- Senão → cascata: `properties.captador_id` → `properties.created_by` → admin/sub_admin da org com phone → `organizations.phone`.
- Retorna: `broker_name, broker_phone, broker_avatar, broker_email, org_name, org_logo, attribution_source`.

**3. Geração de landing — sem duplicação**
- `property_landing_content` permanece chaveado por `property_id` (já é).
- Botão "Criar landing" verifica `EXISTS` antes de chamar IA. Se existe, só cria/recupera o `property_share_links` do corretor atual e devolve URL com token dele.
- Resultado: 2º corretor a clicar "Criar landing" **não** dispara IA — apenas ganha seu próprio token sobre a landing já existente.

**4. Tracking por corretor**
- Nova tabela `property_share_visits (id, share_link_id, visited_at, ip_hash, user_agent, referrer)`.
- Edge `track-landing-visit` chamada no mount da landing → registra visita atribuída.
- `create-site-lead` aceita `broker_token` e atribui `leads.broker_id` automaticamente.

**5. Frontend**
- `useShareLink.ts` → retornar URL com `/{broker_token}` no final; reutilizar registro existente do corretor no imóvel.
- `PropertyLandingPage.tsx` → ler `brokerToken` via `useParams`, chamar `get_landing_contact`, renderizar bloco de contato (foto + nome + WhatsApp + e-mail).
- `App.tsx` → rota `/i/:orgSlug/:propertyCode/:brokerToken?` (token opcional).
- Form de contato envia `broker_token` para o lead ser atribuído ao corretor certo.

### Guardrails
- `broker_token` UNIQUE no banco.
- Token expirado/revogado → fallback gracioso (nunca "indisponível").
- Trigger em `property_share_links`: recusa criar token se broker não tem `phone` (mensagem: "Cadastre seu telefone antes de compartilhar").
- View `vw_landing_links_without_contact` para health check admin.
- RPC `SECURITY DEFINER` com `search_path = public`.

### Arquivos
- `supabase/migrations/<novo>.sql` — coluna, índice, RPC, trigger, view.
- `supabase/functions/create-site-lead/index.ts` — aceitar `broker_token`.
- `supabase/functions/track-landing-visit/index.ts` (nova).
- `src/hooks/useShareLink.ts` — URL com token, reuso por corretor.
- `src/pages/PropertyLandingPage.tsx` — usar nova RPC + bloco de contato.
- `src/App.tsx` — rota com `:brokerToken?`.

### Resultado
- Imóvel gera landing **1x só** (custo IA único, compartilhado entre todos os corretores).
- Cada corretor tem **seu link próprio** com seu contato e atribuição automática de leads/visitas.
- Sem token → fallback para captador/org. Nunca quebra.

