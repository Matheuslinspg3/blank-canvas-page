

# Landing Page de Vendas — portadocorretor.com.br

## Resumo

Hoje, acessar `/` redireciona direto para `/dashboard` (área logada). Vamos criar uma landing page de vendas pública em `/` que só redireciona para `/dashboard` se o usuário já estiver logado. Usuários não logados veem a página de vendas.

## O que será feito

### 1. Nova página `LandingPage.tsx`

Landing page de alta conversão com as seguintes seções:

- **Navbar fixa**: Logo + links (Funcionalidades, Planos, FAQ) + botão "Entrar" (→ /auth) + botão CTA "Criar conta grátis" (→ /auth?tab=cadastro)
- **Hero**: Título forte ("Gerencie sua imobiliária com Inteligência Artificial"), subtítulo, CTA grande "Comece grátis — 15 dias sem compromisso", imagem/mockup do dashboard
- **Logos/Social proof**: "Usado por +X corretores" (badge simples)
- **Funcionalidades** (grid 3 colunas): CRM, Marketplace, IA, WhatsApp, Automações, Landing Pages — ícone + título + descrição curta
- **Como funciona** (3 passos): Crie sua conta → Configure seus imóveis → Gerencie tudo com IA
- **Planos resumidos**: Puxar os 5 planos do banco, exibir cards simplificados com preço e CTA, link "Ver todos os detalhes" → /planos
- **Depoimentos/Trust**: Seção com benefícios-chave em bullets
- **FAQ resumido**: 5 perguntas mais comuns (accordion)
- **CTA final**: "Pronto para transformar sua imobiliária?" + botão grande
- **Footer**: Links (Planos, Privacidade, WhatsApp), copyright

### 2. Rota `/` — lógica condicional

No `App.tsx`, trocar:
```
<Route path="/" element={<Navigate to="/dashboard" replace />} />
```
Por um componente que verifica autenticação:
- Logado → redireciona para `/dashboard`
- Não logado → renderiza `<LandingPage />`

### 3. Design

- Seguir o design system existente (Tailwind, cores do tema, componentes shadcn)
- Responsivo mobile-first
- Seções com fundo alternado (background/muted) para ritmo visual
- CTAs usando o variant `default` (accent) e `gold` para destaque

### Detalhes técnicos

- **Arquivo novo**: `src/pages/LandingPage.tsx`
- **Edição**: `src/App.tsx` — nova lógica na rota `/`
- **Dados**: Query aos `subscription_plans` para seção de planos (mesma query da página /planos)
- **Sem backend**: Página 100% estática/client-side, sem novas Edge Functions

