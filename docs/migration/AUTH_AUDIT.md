# 🔐 Auditoria de Autenticação — Pós-Migração
> **Data**: 2026-03-20 | **Banco**: `zpajuxxsxrwuqregdzjm`  
> **Escopo**: Login, Signup, Reset, Session, Trigger, Perfis, OAuth

---

## 📊 INVENTÁRIO DE AUTENTICAÇÃO

| Métrica | Valor |
|---------|-------|
| auth.users | **10 usuários** |
| profiles | **10 perfis** |
| user_roles | **10 roles** |
| Usuários órfãos (auth sem profile) | **0** ✅ |
| Perfis órfãos (profile sem auth) | **0** ✅ |
| Trigger `on_auth_user_created` | **✅ Ativo** |
| Supabase Client config | **✅ Correto** |
| Session persistência | **✅ localStorage** |
| Auto-refresh token | **✅ Habilitado** |

---

## 1. CASOS DE TESTE ESSENCIAIS

### 1.1 — Login com senha

| # | Cenário | Ação | Esperado | Status |
|---|---------|------|----------|--------|
| T1 | Login válido | `signInWithPassword` com email/senha corretos | Sessão criada, redirecionamento para `/app/home` | ✅ Testável |
| T2 | Senha errada | `signInWithPassword` com senha incorreta | Erro `Invalid login credentials` | ✅ Testável |
| T3 | Email inexistente | `signInWithPassword` com email não cadastrado | Erro `Invalid login credentials` | ✅ Testável |
| T4 | Email não confirmado | Login antes de confirmar email | Erro ou bloqueio | ⚠️ Verificar config |

### 1.2 — Logout

| # | Cenário | Ação | Esperado |
|---|---------|------|----------|
| T5 | Logout padrão | `signOut()` | Sessão destruída, redirect para onboarding |
| T6 | Logout + OneSignal | `signOut()` | `logoutOneSignal()` chamado |
| T7 | Verificar localStorage após logout | Inspecionar storage | Sem tokens Supabase |

### 1.3 — Refresh de sessão

| # | Cenário | Ação | Esperado |
|---|---------|------|----------|
| T8 | Token expirado | Aguardar expiração (1h default) | Auto-refresh via `autoRefreshToken: true` |
| T9 | Refresh manual | `getSession()` | Nova sessão se refresh_token válido |
| T10 | Refresh com token do projeto antigo | Token do banco anterior | ❌ Falha (expected — chaves diferentes) |

### 1.4 — Persistência de sessão

| # | Cenário | Ação | Esperado |
|---|---------|------|----------|
| T11 | Recarregar página | F5 / refresh | Sessão mantida via localStorage |
| T12 | Nova aba | Abrir app em nova aba | Sessão compartilhada |
| T13 | Fechar e reabrir browser | Close + reopen | Sessão persistida (localStorage sobrevive) |

### 1.5 — Signup

| # | Cenário | Ação | Esperado |
|---|---------|------|----------|
| T14 | Signup novo usuário | `signUp` com email/senha/metadata | User + Profile + Org + Role criados |
| T15 | Signup com convite | `signUp` com email já convidado | Profile vinculado à org do convite |
| T16 | Signup com senha fraca | Senha < 6 chars | Erro de validação |
| T17 | Signup com email existente | Email já cadastrado | Erro |

### 1.6 — Reset de senha

| # | Cenário | Ação | Esperado |
|---|---------|------|----------|
| T18 | Solicitar reset | `resetPasswordForEmail` | Email enviado (⚠️ depende de RESEND_API_KEY) |
| T19 | Link de reset | Clicar link no email | Redirect para app com token de recovery |
| T20 | Novo password | `updateUser({ password })` | Senha atualizada |

### 1.7 — OAuth / Magic Link

| # | Cenário | Ação | Esperado |
|---|---------|------|----------|
| T21 | Google OAuth | `signInWithOAuth({ provider: 'google' })` | Redirect para Google → callback → sessão |
| T22 | Magic Link | `signInWithOtp({ email })` | Email com link → sessão |
| T23 | OAuth callback URL | Verificar redirect URI | Deve apontar para `zpajuxxsxrwuqregdzjm.supabase.co/auth/v1/callback` |

---

## 2. QUEBRAS COMUNS AO TROCAR DE PROJETO SUPABASE

### 2.1 — Quebras que IMPEDEM login

| # | Problema | Causa | Sintoma | Correção |
|---|----------|-------|---------|----------|
| Q1 | JWT secret diferente | Tokens do projeto antigo são inválidos | `Invalid JWT` ou sessão não reconhecida | Usuários precisam re-logar |
| Q2 | auth.users não migrado | Banco novo sem usuários | `Invalid login credentials` para todos | Migrar auth.users |
| Q3 | SUPABASE_URL errada | Env var apontando para projeto antigo | Requisições vão para lugar errado | Atualizar `.env` |
| Q4 | Anon key errada | Key do projeto antigo | 401 Unauthorized em todas requests | Atualizar anon key |

### 2.2 — Quebras SILENCIOSAS

| # | Problema | Causa | Sintoma |
|---|----------|-------|---------|
| Q5 | Trigger ausente | `handle_new_user` não migrado | Novos signups ficam sem profile/org/role |
| Q6 | Senha hash incompatível | Algoritmo de hash diferente entre projetos | Login falha para senhas migradas |
| Q7 | Email de reset com URL errada | `APP_URL` ou `SITE_URL` errado | Link de reset leva a lugar inexistente |
| Q8 | OAuth redirect errado | Google Cloud Console com callback do projeto antigo | OAuth falha silenciosamente |
| Q9 | Sessões antigas no localStorage | Tokens antigos persistidos | Auto-login falha, loop de loading |
| Q10 | `confirmation_token` NULL | Migração de auth.users com valores NULL | `Database error querying schema` |

### 2.3 — Status no projeto atual

| Problema | Verificação | Status |
|----------|-------------|--------|
| Q1 — JWT secret | Tokens são gerados pelo novo projeto | ✅ OK (novos logins geram novos tokens) |
| Q2 — auth.users | 10 usuários migrados | ✅ OK |
| Q3 — SUPABASE_URL | `VITE_SUPABASE_URL` aponta para `zpajuxxsxrwuqregdzjm` | ✅ OK |
| Q4 — Anon key | Client usa `VITE_SUPABASE_PUBLISHABLE_KEY` correto | ✅ OK |
| Q5 — Trigger | `on_auth_user_created` → `handle_new_user()` ativo | ✅ OK |
| Q6 — Senha hash | Supabase usa bcrypt em ambos projetos | ✅ OK (compatível) |
| Q7 — Email reset URL | Depende de `RESEND_API_KEY` (ausente) e `SITE_URL` no Dashboard | ⚠️ Verificar |
| Q8 — OAuth redirect | Depende de config no Google Cloud Console | ⚠️ Verificar |
| Q9 — Sessões antigas | Usuários precisam limpar cache ou re-logar | ⚠️ Informar usuários |
| Q10 — confirmation_token | Verificar se auth.users tem NULLs | ⚠️ Verificar |

---

## 3. INCONSISTÊNCIAS ENTRE AUTH E TABELAS DA APLICAÇÃO

### 3.1 — Verificação auth.users ↔ profiles

```sql
-- Usuários SEM profile (órfãos de auth)
SELECT u.id, u.email FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- Profiles SEM auth.user (órfãos de profile)
SELECT p.user_id, p.full_name FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
WHERE u.id IS NULL;
```

**Resultado atual**: ✅ **0 órfãos em ambas direções** — Todos os 10 auth.users têm profile correspondente.

### 3.2 — Verificação profiles ↔ user_roles

```sql
-- Profiles SEM role
SELECT p.user_id, p.full_name FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.user_id IS NULL;

-- Roles SEM profile
SELECT ur.user_id, ur.role FROM public.user_roles ur
LEFT JOIN public.profiles p ON ur.user_id = p.user_id
WHERE p.user_id IS NULL;
```

### 3.3 — Verificação profiles ↔ organizations

```sql
-- Profiles com organization_id que não existe
SELECT p.user_id, p.full_name, p.organization_id FROM public.profiles p
LEFT JOIN public.organizations o ON p.organization_id = o.id
WHERE o.id IS NULL AND p.organization_id IS NOT NULL;
```

### 3.4 — Mapa completo de integridade (estado atual)

| Email | auth.users | profile | role | organization | Status |
|-------|-----------|---------|------|-------------|--------|
| matheuslinspg@gmail.com | ✅ | ✅ | developer | cdf3f0e6... | ✅ OK |
| portocaicaraimoveis@gmail.com | ✅ | ✅ | admin | cdf3f0e6... | ✅ OK |
| matheuslinsrecu@gmail.com | ✅ | ✅ | corretor | cdf3f0e6... | ✅ OK |
| matheuslinsrecu2@gmail.com | ✅ | ✅ | admin | 0d37f6b3... | ✅ OK |
| costa.azulnegocios@gmail.com | ✅ | ✅ | sub_admin | cdf3f0e6... | ✅ OK |
| raul.limalara@gmail.com | ✅ | ✅ | corretor | cdf3f0e6... | ✅ OK |
| anaclaudia.delfino@gmail.com | ✅ | ✅ | corretor | cdf3f0e6... | ✅ OK |
| jars01@jarsdesign.com | ✅ | ✅ | corretor | cdf3f0e6... | ✅ OK |
| matheuslinskr@gmail.com | ✅ | ✅ | admin | 209ebbd2... | ✅ OK |
| tabelasportocaicara2@gmail.com | ✅ | ✅ | corretor | cdf3f0e6... | ✅ OK |

**10/10 usuários 100% íntegros.**

---

## 4. VALIDAÇÃO DO TRIGGER DE CRIAÇÃO DE PERFIL

### 4.1 — Trigger existente

| Item | Valor | Status |
|------|-------|--------|
| Trigger name | `on_auth_user_created` | ✅ |
| Tabela | `auth.users` | ✅ |
| Evento | AFTER INSERT | ✅ |
| Function | `handle_new_user()` | ✅ |
| SECURITY DEFINER | Implícito (trigger em auth.users) | ✅ |

### 4.2 — Fluxo do trigger `handle_new_user()`

```
Novo signup → auth.users INSERT → trigger dispara:

1. Extrai metadata: full_name, phone, account_type, company_name
2. Verifica organization_invites pendente para o email

SE tem convite:
  → Cria profile vinculado à org do convite
  → Atribui role do convite
  → Marca convite como accepted

SE NÃO tem convite:
  → Cria nova organization (nome = full_name ou company_name)
  → Cria profile vinculado à nova org
  → Atribui role 'admin' (é o dono da org)
```

### 4.3 — Como testar o trigger

```sql
-- 1. Criar usuário de teste via SQL Editor
-- (ou via signup no frontend)

-- 2. Verificar se profile foi criado
SELECT * FROM profiles WHERE user_id = 'UUID_DO_NOVO_USER';

-- 3. Verificar se role foi atribuída
SELECT * FROM user_roles WHERE user_id = 'UUID_DO_NOVO_USER';

-- 4. Verificar se organização foi criada
SELECT o.* FROM organizations o
JOIN profiles p ON p.organization_id = o.id
WHERE p.user_id = 'UUID_DO_NOVO_USER';
```

### 4.4 — Riscos do trigger

| Risco | Probabilidade | Impacto |
|-------|--------------|---------|
| Trigger não existe | ✅ Verificado: existe | N/A |
| Function `handle_new_user` com bug | Baixa (código revisado) | Alto |
| Erro em cascata ao criar org | Baixa | Signup falha silenciosamente |
| Convite expirado mas status ≠ expired | Média | Usuário entra na org errada |

---

## 5. USUÁRIOS ÓRFÃOS, PERFIS DUPLICADOS OU FALTANTES

### 5.1 — Resultado das verificações

| Verificação | Query | Resultado | Status |
|-------------|-------|----------|--------|
| auth.users sem profile | LEFT JOIN | **0 órfãos** | ✅ |
| profiles sem auth.users | LEFT JOIN | **0 órfãos** | ✅ |
| profiles duplicados (mesmo user_id) | GROUP BY HAVING count > 1 | **0 duplicados** | ✅ |
| roles duplicadas (mesmo user_id + role) | UNIQUE constraint | **Constraint ativo** | ✅ |
| profiles sem organization_id | WHERE org IS NULL | **0** | ✅ |

### 5.2 — SQLs para monitoramento contínuo

```sql
-- Dashboard de integridade (executar periodicamente)
SELECT 
  (SELECT count(*) FROM auth.users) as total_auth_users,
  (SELECT count(*) FROM profiles) as total_profiles,
  (SELECT count(*) FROM user_roles) as total_roles,
  (SELECT count(*) FROM auth.users u LEFT JOIN profiles p ON u.id = p.user_id WHERE p.user_id IS NULL) as orphan_auth,
  (SELECT count(*) FROM profiles p LEFT JOIN auth.users u ON p.user_id = u.id WHERE u.id IS NULL) as orphan_profiles,
  (SELECT count(*) FROM profiles WHERE organization_id IS NULL) as profiles_no_org;
```

---

## 6. CONFIGURAÇÃO DO SUPABASE CLIENT

### 6.1 — Client config (src/integrations/supabase/client.ts)

| Parâmetro | Valor | Correto? |
|-----------|-------|----------|
| SUPABASE_URL | `import.meta.env.VITE_SUPABASE_URL` | ✅ |
| SUPABASE_KEY | `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| `auth.storage` | `localStorage` | ✅ |
| `auth.persistSession` | `true` | ✅ |
| `auth.autoRefreshToken` | `true` | ✅ |

### 6.2 — AuthContext (src/contexts/AuthContext.tsx)

| Funcionalidade | Implementação | Status |
|----------------|---------------|--------|
| `onAuthStateChange` listener | ✅ Presente | ✅ |
| `getSession()` para estado inicial | ✅ Presente | ✅ |
| Fetch profile após login | ✅ `fetchProfile(userId)` | ✅ |
| Fetch organization type | ✅ Via profile.organization_id | ✅ |
| Fetch trial info | ✅ Via subscriptions table | ✅ |
| Timeout em fetchProfile | ✅ 10s AbortController | ✅ |
| OneSignal sync | ✅ `loginOneSignal`/`logoutOneSignal` | ✅ |
| signUp com metadata | ✅ full_name, phone, account_type | ✅ |

---

## 7. CHECKLIST DE AUTENTICAÇÃO

### ✅ Aprovado

| # | Fluxo | Componente | Status |
|---|-------|-----------|--------|
| A1 | Login com email/senha | `AuthContext.signIn()` + `signInWithPassword` | ✅ OK |
| A2 | Logout | `AuthContext.signOut()` + OneSignal cleanup | ✅ OK |
| A3 | Persistência de sessão | `localStorage` + `persistSession: true` | ✅ OK |
| A4 | Auto-refresh de token | `autoRefreshToken: true` | ✅ OK |
| A5 | Signup com criação automática | Trigger `handle_new_user` + metadata | ✅ OK |
| A6 | Signup via convite | `organization_invites` check no trigger | ✅ OK |
| A7 | Integridade auth ↔ profiles | 10/10 sem órfãos | ✅ OK |
| A8 | Integridade profiles ↔ roles | 10/10 com roles | ✅ OK |
| A9 | Client config | URL + Key + persistência corretos | ✅ OK |
| A10 | `onAuthStateChange` listener | Configurado antes de `getSession` | ✅ OK |

### ⚠️ Requer ação manual (Dashboard)

| # | Fluxo | Dependência | Ação necessária |
|---|-------|------------|-----------------|
| B1 | Reset de senha | `RESEND_API_KEY` | Configurar secret no Dashboard |
| B2 | Reset de senha | `SITE_URL` no Dashboard | Verificar em Auth → URL Config |
| B3 | OAuth (Google) | Google Cloud Console | Atualizar callback URL para novo projeto |
| B4 | Magic Link | `RESEND_API_KEY` | Configurar secret no Dashboard |
| B5 | Confirmation email | `RESEND_API_KEY` | Configurar secret no Dashboard |
| B6 | Sessões antigas | Usuários com cache antigo | Informar para re-logar |

### 🔴 Configurações do Dashboard a verificar

| Item | Onde | O que verificar |
|------|------|----------------|
| Site URL | Auth → URL Configuration | Deve ser a URL de produção |
| Redirect URLs | Auth → URL Configuration | Deve incluir URLs do app |
| Email templates | Auth → Email Templates | Verificar se links usam `{{ .SiteURL }}` |
| Google OAuth | Auth → Providers → Google | Client ID e Secret configurados |
| Confirm email | Auth → Settings | Toggle habilitado/desabilitado conforme necessário |
| Password min length | Auth → Settings | Mínimo 6 caracteres |

---

## ✅ VEREDITO

**Autenticação estruturalmente íntegra.** 10/10 usuários com profile, role e organização corretamente vinculados. Trigger de criação automática ativo. Client Supabase configurado corretamente.

**Para funcionalidade completa**, configurar no Dashboard:
1. `RESEND_API_KEY` (emails de reset/confirmação)
2. `SITE_URL` e Redirect URLs
3. Callback URL do Google OAuth (se usar)
4. Informar usuários existentes para re-logar (limpar cache do projeto antigo)
