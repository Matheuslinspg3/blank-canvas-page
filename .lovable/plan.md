

# Plano: Corrigir Banco de Dados e Contas

## Diagnóstico

O problema principal: **o trigger `handle_new_user` NÃO está conectado à tabela `auth.users`**. A função existe, mas nunca dispara. Por isso:

- **0 profiles** (tabela vazia)
- **0 organizations** (tabela vazia)  
- **0 user_roles** (tabela vazia)
- Login falha com **"Database error querying schema"** porque o sistema tenta buscar perfil/role que não existe

### Contas existentes (10 usuários)

| Email | Nome | Tipo |
|-------|------|------|
| matheuslinspg@gmail.com | Matheus | corretor_individual |
| portocaicaraimoveis@gmail.com | Rodrigo Brito Lima | imobiliaria |
| matheuslinsrecu@gmail.com | Matheus Lins | corretor_individual |
| matheuslinsrecu2@gmail.com | Teste Corretor | corretor_individual |
| costa.azulnegocios@gmail.com | Rebeca Adriana Cyrieco | corretor_individual |
| raul.limalara@gmail.com | Raul Correa de Lara | corretor_individual |
| anaclaudia.delfino@gmail.com | Claudia Delfino | corretor_individual |
| jars01@jarsdesign.com | Clodoaldo | corretor_individual |
| matheuslinskr@gmail.com | aaaaaaa | corretor_individual |
| tabelasportocaicara2@gmail.com | Tabelas Porto Caiçara | corretor_individual |

---

## Plano de Execução

### Passo 1 — Reconectar o trigger `handle_new_user`

Criar migration que reconecta o trigger à tabela `auth.users`:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Passo 2 — Criar dados faltantes para os 10 usuários existentes

Uma migration que, para cada usuário:

1. **Cria a organização** (usando `company_name` ou `full_name` do metadata)
2. **Cria o profile** vinculado à organização
3. **Cria o user_role** como `admin`

Isso será feito com um bloco PL/pgSQL que percorre `auth.users` e insere os registros faltantes, respeitando os triggers existentes (slug automático, etc).

### Passo 3 — Resetar senhas de todos os usuários

Criar uma **edge function temporária** ou usar a edge function `admin-users` existente para resetar as senhas. Como você disse "a primeira senha digitada será a nova senha", vou alterar a página de login (`/auth`) para que, quando o login falhar com erro de senha, o sistema tente atualizar a senha via edge function.

**Alternativa mais segura**: Criar uma migration/script que reseta todas as senhas para um valor temporário padrão (ex: `Habitae2026!`) e informar os usuários para trocar na primeira vez.

### Passo 4 — Verificar que o login funciona

Após os passos anteriores, o fluxo será:
1. Usuário acessa `/auth`
2. Digita email + nova senha
3. Login funciona, profile/org/role já existem

---

## Detalhes Técnicos

- O trigger será criado no schema `public` referenciando `auth.users` (padrão Supabase, permitido para triggers AFTER INSERT)
- A função `handle_new_user` já lida com criação de org + profile + role, então novos cadastros futuros funcionarão automaticamente
- As senhas serão resetadas via `auth.admin.updateUserById` na edge function `admin-users` (que já tem esse endpoint PATCH)

