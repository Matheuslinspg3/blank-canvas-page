## Problema

Em `https://portocaicaraimoveis.com.br/imovel/1796` a landing page abre, mas:
1. Mostra logo / favicon / cores do "Porta do Corretor" em vez da Porto Caiçara.
2. O card "Seu contato" no sidebar fica em branco.

## Causa raiz

**1. White-label não roda para visitante anônimo em domínio customizado.**
`useWhiteLabel()` (usado por `HabitaeLogo` e que injeta `--primary`/`--accent` no `<html>`) depende de `useAuth().profile?.organization_id`. Em domínio público não há sessão → hook retorna `enabled: false`, mantém o tema padrão e o logo padrão `porta-logo.png`. O `SEOHead` da landing também não recebe `favicon` nem `siteName`, então o favicon `/favicon.png` do Porta continua ativo e o `<title>` ganha "— Porta do Corretor".

**2. Contato vem vazio porque o card depende do telefone do corretor/admin.**
A RPC `get_landing_contact` cobre 4 fontes: `shared_link → captador_id → created_by → admin com telefone`. O sidebar só renderiza o card quando `contact?.broker_name || contact?.broker_phone || contact?.org_phone` é truthy. Quando é acesso direto (sem `brokerToken`) e a org não tem captador/created_by/admin com telefone preenchido, todos os campos voltam `null` e o card simplesmente desaparece — sem fallback nenhum (nem nome da imobiliária, nem WhatsApp do site).

Além disso, o `org_phone` retornado vem de `organizations.phone`. O telefone real configurado pela imobiliária mora geralmente em `website_settings.whatsapp_number` / `contact_phone`, que a RPC ignora hoje.

## O que fazer

### A) Branding white-label em domínio customizado/público

1. **Novo hook `usePublicBranding(organizationId)`** em `src/hooks/usePublicBranding.ts`:
   - Reusa `get_public_org_by_id` + `get_public_brand_settings` (já públicas, GRANT anon).
   - Aplica as variáveis CSS (`--primary`, `--accent`, `--secondary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`) no `document.documentElement` via `useEffect`, com cleanup, replicando a lógica `hexToHSL` de `useWhiteLabel`.
   - Retorna `{ orgName, logoUrl, faviconUrl, primaryColor, ... }`.

2. **Integrar em `TenantRouter`**: ao detectar `isExternalDomain && organizationId`, montar um wrapper `<PublicBrandingProvider organizationId={...}>` em volta de `PropertyLandingPage` e da rota de páginas (`WhiteLabelStorefront` já busca brand por outro caminho — manter, mas o provider cuida do tema global).

3. **`PropertyLandingPage`**:
   - Quando `organizationIdOverride` (ou orgId resolvido a partir do property) existir, usar `usePublicBranding`.
   - Passar `favicon={brand.logoUrl}` e `siteName={brand.orgName}` para `<SEOHead>` (lógica de title white-label já existe em `SEOHead`).
   - Passar `forceDefault={!brand.enabled}` ao `<HabitaeLogo>` — quando há branding público, renderizar `<img src={brand.logoUrl}>` diretamente em vez de `HabitaeLogo` (mais simples e evita depender de `useAuth`). Adicionar prop opcional `logoUrl` ao header da landing.

### B) Contato sempre presente

1. **Estender `get_landing_contact`** (nova migração) para também retornar:
   - `org_whatsapp` ← `website_settings.whatsapp_number`
   - `org_contact_phone` ← `website_settings.contact_phone`
   - `org_contact_email` ← `website_settings.contact_email`
   
   Continua `SECURITY DEFINER`, mantém GRANT a `anon`.

2. **`PropertyLandingPage`**:
   - Atualizar `LandingContact` interface com os novos campos.
   - Mudar a condição de render do card de contato para sempre renderizar quando houver pelo menos `org_name` (ou seja, quando a RPC retornou alguma linha) — fazendo fallback em ordem:
     - **Telefone exibido**: `broker_phone || org_whatsapp || org_contact_phone || org_phone`.
     - **Nome exibido**: `broker_name || org_name || "Fale com a imobiliária"`.
     - **Avatar**: `broker_avatar || org_logo` (com placeholder).
   - O botão de WhatsApp/telefone usa o primeiro telefone disponível.
   - Garantir que mesmo sem nenhum telefone, o formulário inferior continua funcionando (já é o caso) e adicionar uma linha "Envie sua mensagem usando o formulário abaixo" como CTA secundário.

3. **Form inferior `Contato`** (botão sticky no header já rola para o `<form>`): manter, mas exibir, acima do form, o nome/logo da imobiliária quando `contact.org_name` existir, para que mesmo sem telefone haja branding visível.

## Arquivos a alterar

- `supabase/migrations/<novo>.sql` — `CREATE OR REPLACE FUNCTION public.get_landing_contact(...)` retornando 3 colunas extras.
- `src/integrations/supabase/types.ts` — regenerado automaticamente após migração (não editar manualmente).
- `src/hooks/usePublicBranding.ts` — novo.
- `src/components/TenantRouter.tsx` — envolver `PropertyLandingPage` com provider/branding.
- `src/pages/PropertyLandingPage.tsx`:
  - Importar `usePublicBranding`.
  - Atualizar `LandingContact`.
  - Substituir `<HabitaeLogo>` por logo dinâmico no header (ou passar `forceDefault` correto).
  - Passar `favicon`/`siteName` ao `<SEOHead>`.
  - Reescrever a condição e o conteúdo do card "Seu contato".
- (Opcional) `src/components/HabitaeLogo.tsx` — aceitar `logoUrl`/`orgName` via props, sem depender de `useAuth`.

## Validação

1. `npm test` (sem novos testes obrigatórios; ajustar mocks se algum teste depender de `LandingContact`).
2. Manual no preview com `?organizationIdOverride=<id porto caiçara>` ou rodando o domínio em `localhost` via override de hostname.
3. Após deploy: abrir `https://portocaicaraimoveis.com.br/imovel/1796`, conferir favicon, logo no header, cores primárias e card de contato preenchido.

## Notas

- Sem mudanças em RLS/policies — apenas estendendo uma RPC já SECURITY DEFINER.
- Sem impacto em rotas internas (`/imovel/:id` autenticadas) porque a injeção de variáveis CSS só roda quando `organizationId` vem do `TenantRouter` (visitante público).
- Mantém o watchdog/Error Boundary existente.
