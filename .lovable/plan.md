

## Diagnóstico

O `signInWithOAuth({provider:'google'})` apenas inicia um redirect para o Google. O erro `EMAIL_ALREADY_REGISTERED` levantado pelo trigger `handle_new_user` ocorre **depois** que o Google devolve o controle para o callback do Supabase — quando o Supabase tenta criar a linha em `auth.users`. Nesse momento, o Supabase aborta o login e redireciona o navegador de volta para o `redirectTo` (`/dashboard`) **com parâmetros de erro no hash da URL**, no formato:

```
/dashboard#error=server_error&error_code=unexpected_failure&error_description=Database%20error%20saving%20new%20user
```

Portanto:
- O `signInWithGoogle()` no `AuthContext` **não recebe** esse erro (a Promise resolve com sucesso antes do redirect).
- O `GoogleSignInButton` **não vê** o erro.
- Hoje o usuário é jogado em `/dashboard` sem sessão, o `ProtectedRoute` o devolve para `/auth`, e ele fica confuso sem nenhuma mensagem.

## Onde interceptar

A única camada que tem visibilidade global do retorno do OAuth é o `AuthProvider` em `src/contexts/AuthContext.tsx`, que já roda no boot do app. Vamos adicionar lá uma checagem do `window.location.hash` (e do `search` como fallback) **antes** do `getSession()`, identificar o padrão de colisão e disparar um toast amigável.

## Mudanças

### 1. `src/contexts/AuthContext.tsx` — interceptar hash de erro do OAuth

Adicionar no início do `useEffect` de bootstrap, antes do `supabase.auth.getSession()`:

```ts
// Intercepta erros do callback OAuth (vêm no hash da URL após redirect do Supabase)
const parseOAuthError = () => {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const error = params.get('error');
  const errorCode = params.get('error_code');
  const errorDescription = params.get('error_description');
  if (!error && !errorCode && !errorDescription) return null;
  return { error, errorCode, errorDescription };
};

const oauthError = parseOAuthError();
if (oauthError) {
  const desc = decodeURIComponent(oauthError.errorDescription ?? '');
  // Guard do handle_new_user → Supabase devolve "Database error saving new user"
  // ou propaga "EMAIL_ALREADY_REGISTERED" dependendo da versão do GoTrue
  const isEmailCollision =
    /EMAIL_ALREADY_REGISTERED/i.test(desc) ||
    /Database error saving new user/i.test(desc);

  if (isEmailCollision) {
    toast.error('Já existe uma conta com este email', {
      description:
        'Faça login com sua senha original ou use "Esqueci minha senha" para recuperar o acesso. Depois de entrar, você pode vincular o Google nas configurações.',
      duration: 10000,
    });
    // Redireciona para /auth para o usuário tentar com senha
    setTimeout(() => {
      window.history.replaceState(null, '', '/auth');
      window.location.hash = '';
    }, 0);
  } else if (oauthError.error) {
    toast.error('Erro ao entrar com Google', {
      description: desc || 'Tente novamente em instantes.',
      duration: 8000,
    });
    window.history.replaceState(null, '', window.location.pathname);
  }
}
```

**Detalhes importantes:**
- Roda uma única vez no mount do `AuthProvider`, **antes** do `getSession()`, garantindo que o erro seja tratado mesmo que não exista sessão.
- Limpa o hash da URL (`history.replaceState`) para não disparar o toast novamente em recargas.
- O regex cobre dois cenários: GoTrue propaga literalmente o `EMAIL_ALREADY_REGISTERED:` em alguns casos, mas em outros mascara como `Database error saving new user` (mensagem genérica do GoTrue ao receber `unique_violation` do trigger). Capturamos os dois.

### 2. `src/components/auth/GoogleSignInButton.tsx` — sem alterações funcionais

O botão continua tratando apenas erros do **redirect inicial** (provider desabilitado, config inválida). O erro pós-callback é tratado globalmente no AuthContext.

## O que NÃO muda

- Fluxo feliz de Google (email novo ou já confirmado com link automático): inalterado, sem hash de erro → nenhum toast.
- Login com email/senha: inalterado.
- `handle_new_user` e o guard SQL: inalterados.
- `GoogleSignInButton` em todas as telas: inalterado.

## Arquivos alterados

- `src/contexts/AuthContext.tsx` (adiciona ~30 linhas de interceptação de erro OAuth no useEffect de bootstrap)

## Resultado esperado

| Cenário | Comportamento |
|---|---|
| Google + email novo | Login normal → onboarding |
| Google + email confirmado existente | Account linking automático → dashboard |
| Google + email **não confirmado** existente | Toast amigável + redirect para `/auth` |
| Google cancelado pelo usuário | Toast genérico "Erro ao entrar com Google" |

