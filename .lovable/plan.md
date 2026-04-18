

## Diagnóstico Técnico — Passkeys no Porta do Corretor

### Contexto atual relevante
- Supabase Auth (email/senha + Google OAuth via `@supabase/supabase-js`).
- Sessão controlada por `AuthContext`, com `useSessionGuard` (limite 2 dispositivos via `register_session` RPC).
- `handle_new_user` provisiona organization/profile/role/subscription.
- Domínios: `portadocorretor.com.br`, `www.portadocorretor.com.br`, subdomínios white-label `*.portadocorretor.com.br`, e domínios customizados de tenants.
- **Supabase Auth não tem suporte nativo a WebAuthn/passkeys.** Precisa ser implementado em camada própria (Edge Functions + tabela própria), reaproveitando a sessão Supabase.

---

### 1. Estratégia recomendada: passkey como **método complementar pós-login** (Fase 1)

**Recomendação:** começar como **2º fator opcional / método de re-login rápido**, NÃO como login primário inicial.

**Por quê:**
- Base de usuários já existente (email/senha + Google). Forçar passkey no primeiro login quebra o fluxo.
- Passkeys exigem dispositivo compatível (iOS 16+, Android 9+, navegadores modernos). Há corretores em equipamentos antigos.
- Recovery de passkey é complexo — manter email/senha como fallback evita bloqueio total.
- Permite rollout gradual e validação de UX antes de oferecer "login só com passkey".

**Fase 2 (futura):** quando ≥30% dos usuários tiverem passkey registrada e métricas de sucesso forem boas, oferecer "Entrar com passkey" direto na tela `/auth` como atalho ao lado do Google.

---

### 2. Integração com a sessão Supabase (sem quebrar nada)

**Padrão escolhido: WebAuthn → Edge Function → mint de sessão Supabase via `admin.generateLink` (magiclink) ou `admin.createSession` (signInWithIdToken não se aplica).**

Fluxo de **registro** (usuário já autenticado):
```
1. UI: usuário clica "Adicionar passkey" em /settings/security
2. Edge Function passkey-register-options → gera challenge, salva em webauthn_challenges
3. Browser: navigator.credentials.create() com options
4. Edge Function passkey-register-verify → valida attestation, salva credencial em user_passkeys
5. Toast: "Passkey registrada"
```

Fluxo de **autenticação** (re-login rápido):
```
1. UI em /auth: botão "Entrar com passkey" (se navegador suporta)
2. Edge Function passkey-auth-options → challenge + allowCredentials (por email opcional)
3. Browser: navigator.credentials.get()
4. Edge Function passkey-auth-verify → valida assertion contra public_key armazenada
5. Edge Function chama supabase.auth.admin.generateLink({ type: 'magiclink', email })
   → extrai hashed_token → retorna ao client
6. Client: supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) → sessão criada
7. AuthContext detecta SIGNED_IN → fluxo normal segue
```

**Por que `generateLink` + `verifyOtp`:** é o único caminho oficial Supabase para criar sessão sem senha a partir de validação backend, sem precisar de service role no client. `auth.admin.createUser` + impersonation NÃO criam sessão válida no client.

**Compatibilidade:** zero impacto em email/senha e Google. AuthContext, ProtectedRoute, useSessionGuard, handle_new_user permanecem intactos. Passkey é um caminho paralelo que termina chamando `verifyOtp`.

---

### 3. Componentes técnicos necessários

#### 3.1. Banco de dados (1 migration)

```sql
-- Credenciais registradas
create table public.user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text unique not null,        -- base64url
  public_key text not null,                  -- base64url COSE key
  counter bigint not null default 0,
  transports text[] default '{}',            -- ['internal','hybrid','usb',...]
  device_name text,                          -- "iPhone de João"
  aaguid uuid,                               -- identifica autenticador
  backed_up boolean default false,
  created_at timestamptz default now(),
  last_used_at timestamptz
);
alter table public.user_passkeys enable row level security;
create policy "users read own passkeys" on public.user_passkeys
  for select using (user_id = auth.uid());
create policy "users delete own passkeys" on public.user_passkeys
  for delete using (user_id = auth.uid());
-- INSERT/UPDATE somente via edge function (service role)

-- Challenges efêmeros (TTL 5min)
create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  user_id uuid references auth.users(id) on delete cascade,  -- null em auth flow por email
  email text,
  type text not null check (type in ('registration','authentication')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz
);
alter table public.webauthn_challenges enable row level security;
-- Acesso somente via service role
```

#### 3.2. Edge Functions (4 novas)

| Função | Auth | Responsabilidade |
|---|---|---|
| `passkey-register-options` | JWT do usuário | Gera challenge, retorna `PublicKeyCredentialCreationOptions` |
| `passkey-register-verify` | JWT do usuário | Valida attestation, persiste em `user_passkeys` |
| `passkey-auth-options` | público | Gera challenge (com email opcional para `allowCredentials`) |
| `passkey-auth-verify` | público | Valida assertion, gera magiclink, retorna `token_hash` |

**Lib recomendada:** `@simplewebauthn/server` (Deno-compatível via npm:). Cobre attestation/assertion verification, COSE key parsing, counter check.

#### 3.3. Frontend

- `src/lib/passkeys/client.ts` — wrapper de `navigator.credentials.create/get` + base64url helpers
- `src/components/settings/PasskeysSection.tsx` — listar/registrar/remover passkeys (em Settings → Segurança)
- `src/components/auth/PasskeyLoginButton.tsx` — botão na tela `/auth` (Fase 1.5)
- `src/hooks/usePasskeySupport.ts` — detecta `window.PublicKeyCredential` + `isUserVerifyingPlatformAuthenticatorAvailable()`

#### 3.4. RP ID (Relying Party) — **decisão crítica**

Passkey fica vinculada ao RP ID (domínio). Precisamos decidir:

| Opção | RP ID | Pros | Contras |
|---|---|---|---|
| **A. Apex** | `portadocorretor.com.br` | Funciona em `www`, app, e em qualquer subdomínio `*.portadocorretor.com.br` (white-label da plataforma) | Não funciona em domínios customizados de tenants (ex: `imobiliariaX.com.br`) |
| B. Por host | host atual | Cada domínio tem suas próprias passkeys | Usuário com passkey no app não usa em outro subdomínio; complexidade alta |

**Recomendação: Opção A** — RP ID = `portadocorretor.com.br`. Passkeys são feature do **app do corretor** (login no painel), não do storefront público nem dos sites white-label. Usuários sempre logam em `portadocorretor.com.br` ou `www.portadocorretor.com.br`. Domínios customizados de tenants são para visitantes finais (compradores), não usam login.

---

### 4. Riscos e mitigações

| Risco | Mitigação Fase 1 |
|---|---|
| **Recovery (perdeu dispositivo)** | Email/senha continua ativo como fallback. Botão "Esqueci minha senha" segue funcionando. Passkey nunca é único método. |
| **Múltiplos dispositivos** | Tabela permite N passkeys por usuário. UI lista com `device_name`, permite remover. Synced passkeys (iCloud Keychain, Google Password Manager) propagam automaticamente. |
| **RP ID em subdomínios white-label** | Resolvido pela decisão de manter passkey só no domínio do app (apex). |
| **Phishing / credential stuffing** | Passkeys são resistentes a phishing por design (RP ID binding). Ganho de segurança real. |
| **Counter rollback (clone detection)** | Validar `counter > stored_counter` em cada autenticação. Se falhar, alertar usuário e desabilitar credencial. |
| **Compatibilidade de navegador** | `usePasskeySupport` esconde botão se não suportado. Sem degradação. |
| **Conflito com `useSessionGuard` (2 dispositivos)** | Sem conflito — passkey só termina o fluxo via `verifyOtp`, que dispara o mesmo `SIGNED_IN` e o guard age normalmente. |
| **UX: usuário não entende o que é passkey** | Tooltip/modal explicativo: "Entre sem digitar senha usando Face ID, Touch ID ou Windows Hello". |
| **Suporte / abuso** | Audit log de registros e remoções de passkey em `audit_logs`. |
| **Challenge replay** | Tabela `webauthn_challenges` com `expires_at` (5min) e `consumed_at` marcado no verify. |

---

### 5. Estratégia de rollout

```
Fase 0 — Fundação (este plano)
  └─ Migration + 4 edge functions + lib client + Settings UI
  └─ Disponível só para `developer` role (feature flag manual)

Fase 1 — Beta interno (1-2 semanas)
  └─ Liberar para todos os usuários em Settings → Segurança
  └─ Apenas registro/uso pós-login (re-autenticação para ações sensíveis)
  └─ Métricas: nº de registros, taxa de sucesso de auth, erros

Fase 1.5 — Login com passkey (após ≥50 usuários com passkey ativa)
  └─ Botão "Entrar com passkey" na /auth (acima de Google)
  └─ Detecta suporte do browser, esconde se ausente

Fase 2 — Promoção ativa (futuro)
  └─ Banner pós-login: "Ative passkey para entrar mais rápido"
  └─ Onboarding sugere registrar passkey após primeiro login

Fase 3 — Login passwordless-first (futuro distante)
  └─ Padrão na /auth muda para passkey
  └─ Email/senha continua como "outras formas de entrar"
```

---

### 6. Etapas sugeridas de implementação (próximo prompt)

1. **Migration**: tabelas `user_passkeys` + `webauthn_challenges` + RLS.
2. **Secret/config**: definir `WEBAUTHN_RP_ID=portadocorretor.com.br` e `WEBAUTHN_RP_NAME=Porta do Corretor` (constantes nas edge functions).
3. **Edge Functions** (4): registrar com `@simplewebauthn/server`.
4. **Client lib**: `src/lib/passkeys/client.ts` (encoding + chamadas).
5. **UI Settings**: `PasskeysSection.tsx` listando/registrando/removendo.
6. **Hook de suporte**: `usePasskeySupport.ts`.
7. **Rollout interno**: liberar primeiro para developers via verificação simples no componente.
8. **Telemetria**: log em `audit_logs` para `passkey_registered`, `passkey_used`, `passkey_removed`.

Login com passkey na `/auth` (Fase 1.5) fica para um segundo prompt, após validar registro/uso pós-login.

---

### Resumo da recomendação

- **Modelo:** complementar pós-login na Fase 1, com login direto em Fase 1.5.
- **Integração Supabase:** WebAuthn validado em Edge Function → `admin.generateLink` → `verifyOtp` no client. Zero alteração no fluxo email/senha e Google.
- **RP ID:** apex `portadocorretor.com.br` (passkey é feature do app, não dos sites tenant).
- **Biblioteca:** `@simplewebauthn/server` (Deno) + WebAuthn API nativa no browser.
- **Recovery:** email/senha permanece como fallback obrigatório nesta fase.
- **Esforço Fase 0+1:** ~1 migration, 4 edge functions, 1 página em Settings, 1 hook, 1 lib client. Estimativa ~10-14h.

