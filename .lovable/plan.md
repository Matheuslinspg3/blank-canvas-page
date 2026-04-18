

## Plano — Login com passkey na tela /auth (Fase 1.5)

### Estratégia de rollout

**Feature flag por role + suporte do navegador.** Mantenho a mesma regra usada na seção de Settings: visível apenas para `useUserRoles().isDeveloper`. Quando estabilizar, troco a flag para `true` (ou ligo via `useFeatureFlag`). Não vou criar uma nova tabela de flags agora — reaproveito o padrão `isDeveloper` que já gateia a `PasskeysSection`. Isso garante consistência: quem registrou passkey também é quem vê o botão de login.

Adicionalmente, o botão só renderiza se `usePasskeySupport().isSupported` for verdadeiro, evitando degradação em navegadores antigos.

### Componentes

**Novo:** `src/components/auth/PasskeyLoginButton.tsx`
- Reusa `authenticateWithPasskey()` do `src/lib/passkeys/client.ts` (já termina em `verifyOtp` → sessão Supabase nativa).
- Aceita `email?: string` opcional (passa o email do form de login se preenchido, para limitar `allowCredentials`; senão usa fluxo "discoverable credential" — o navegador mostra todas as passkeys do RP).
- Estados: idle / loading. Após sucesso, o `onAuthStateChange` do `AuthContext` redireciona normalmente — sem navegação manual aqui.
- Tratamento de erro:
  - `NotAllowedError` / cancel → `toast.info("Autenticação cancelada")`
  - sem credencial → `toast.error` orientando usar senha/Google
  - erro genérico → `toast.error` com mensagem
- Visual: `variant="outline"`, mesma altura/estilo do `GoogleSignInButton`, ícone `Fingerprint`, label **"Entrar com biometria"**.

**Gating local:** o componente faz check interno (`isDeveloper && isSupported && checked`) e retorna `null` se não atende. Assim o `Auth.tsx` apenas renderiza `<PasskeyLoginButton email={loginForm.email} />` sem precisar saber das flags.

### Integração em `src/pages/Auth.tsx`

Apenas no formulário de **login** (não no signup — passkey de signup vem em fase futura). Posicionar acima do `GoogleSignInButton` na linha 627, com o mesmo divisor "ou":

```
[Form senha]
[Botão "Entrar"]
[divisor "ou continue com"]
[PasskeyLoginButton]   ← novo
[GoogleSignInButton]
```

Se o `PasskeyLoginButton` retornar `null` (usuário sem rollout / sem suporte), o layout fica idêntico ao atual. Zero risco de quebra.

### Compatibilidade

- Email/senha: intacto (form e handler `handleLogin` não tocados).
- Google: intacto (`GoogleSignInButton` permanece).
- `AuthContext` / `useSessionGuard`: intactos — o `verifyOtp` interno do `authenticateWithPasskey` dispara `SIGNED_IN`, que aciona o guard normalmente (1 PC + 1 mobile mantido).
- `handle_new_user`: não roda (usuário já existe).
- Onboarding/roles: preservados porque a sessão criada é a sessão real do usuário.

### Arquivos alterados

- **Novo:** `src/components/auth/PasskeyLoginButton.tsx` (~70 linhas)
- **Editado:** `src/pages/Auth.tsx` (1 import + ~6 linhas no bloco de login, próximo à linha 627)

### Checklist de teste end-to-end

1. **Setup** (como developer):
   - Acessar Settings → Passkeys → registrar passkey neste dispositivo (Face ID / Touch ID / Windows Hello).
2. **Logout** → ir para `/auth`.
3. **Visibilidade do botão:**
   - Aparece para developer com browser compatível.
   - Não aparece para usuário não-developer.
   - Não aparece em browser sem WebAuthn.
4. **Login com passkey vazio (discoverable):**
   - Não digitar email → clicar "Entrar com biometria" → navegador lista passkeys → autenticar.
   - Sessão criada, redireciona para `/dashboard`.
5. **Login com email pré-preenchido:**
   - Digitar email → clicar "Entrar com biometria" → autenticar.
6. **Cancelamento:**
   - Clicar e cancelar prompt biométrico → `toast.info` aparece, sem loop.
7. **Sem passkey registrada:**
   - Em outro dispositivo sem passkey → toast com erro amigável → usuário pode usar senha/Google normalmente.
8. **Session guard:**
   - Logar em PC com passkey + logar em mobile com senha → ambos ativos (≤2).
   - Tentar 3ª sessão → bloqueio normal do `useSessionGuard`.
9. **Roles preservados:** confirmar que `developer` continua ativo após login por passkey.
10. **Onboarding intacto:** logar com passkey de conta sem onboarding completo → redireciona para onboarding.
11. **Email/senha e Google ainda funcionam:** smoke test nos dois fluxos.

