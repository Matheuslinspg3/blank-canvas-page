
## Validação de CPF/CNPJ — Billing/Checkout

### 1. Criar `src/utils/document-validation.ts`

Duas funções puras com algoritmo módulo 11:
- `isValidCPF(cpf: string): boolean` — aceita com/sem máscara, rejeita sequências repetidas e dígitos inválidos
- `isValidCNPJ(cnpj: string): boolean` — mesma lógica com pesos CNPJ
- `isValidDocument(doc: string): boolean` — wrapper que detecta CPF (11 dígitos) ou CNPJ (14 dígitos)

### 2. Validação no `CheckoutDialog.tsx`

- Adicionar estado `cpfError: string | null`
- No `onBlur` do campo CPF/CNPJ: se o documento estiver completo (11 ou 14 dígitos) mas inválido, setar `cpfError` com "CPF inválido" ou "CNPJ inválido"
- Limpar erro quando o usuário volta a digitar
- Exibir mensagem em vermelho abaixo do campo (classe `text-sm text-destructive`)
- Bloquear `handleSubmit` se documento inválido

### 3. Validação na Edge Function `billing/index.ts`

- Adicionar as mesmas funções `isValidCPF`/`isValidCNPJ` inline no topo da Edge Function (Deno não importa de `src/`)
- No fluxo `create-customer` (linha ~109), após verificar que `customerCpf` existe, validar com `isValidDocument`
- Se inválido, retornar `400 { error: "Documento inválido (CPF/CNPJ)" }` sem chamar o Asaas

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `src/utils/document-validation.ts` | Novo — funções `isValidCPF`, `isValidCNPJ`, `isValidDocument` |
| `src/components/billing/CheckoutDialog.tsx` | Validação onBlur + bloqueio de submit |
| `supabase/functions/billing/index.ts` | Validação server-side antes de chamar Asaas |
