

## Revisão de bugs — implementações de hoje

Auditei `ContactDialog`, `notify_marketplace_interest`, `AcceptInvite`, `QuickFormDialog`, `FormulariosSection`, `FinancingSimulator` e `FinancingDocsChecklist`. Encontrei **7 bugs** (1 crítico bloqueante).

### 🔴 BUG 1 — CRÍTICO: ContactDialog mostra fallback invertido

**Arquivo:** `src/components/marketplace/ContactDialog.tsx` linha 132

```tsx
) : !hasAnyData ? (
  // ← bloco com nome/email/logo da imobiliária + botão "Notificar"
```

A condição é `!hasAnyData`, mas o bloco interno **renderiza** `contactData?.org_name`, `org_email`, `org_logo`. Como `hasAnyData` já inclui `org_name` e `org_email`, esse bloco **só roda quando esses campos NÃO existem** — ou seja, nunca exibe o que pretende mostrar. O resultado: usuário sem telefone vê só "Esta imobiliária ainda não cadastrou…" sem nome/logo/email, e o botão "Notificar imobiliária" **nunca aparece quando há dados** (que é justamente quando deveria aparecer como fallback do telefone).

**Correção:** A lógica do fallback deve ser baseada em "tem telefone?", não "tem qualquer dado?". Trocar por:
- `hasPhone = brokerPhone || orgPhone`
- Se `!hasPhone` → renderizar bloco com nome/logo/email (que existem) + botão Notificar
- Renomear `!hasAnyData` para `!hasPhone` e remover a duplicação confusa

### 🟠 BUG 2 — Notificação cria intent duplicada

**Arquivo:** `supabase/migrations/...notify_marketplace_interest.sql` linhas 60–67

A RPC `notify_marketplace_interest` insere em `marketplace_contact_intents` com `contact_type = 'org'`. Mas o frontend (`ContactDialog.openWhatsApp` linha 85) **também** chama `registerIntent()` separadamente quando o usuário clica no WhatsApp. Para o botão "Notificar" isso não duplica, mas o desenho atual cria 2 caminhos de inserção desalinhados (um via SQL, outro via `.from().insert()`). Risco: se o usuário clicar Notificar e depois WhatsApp, gera 2 registros.

**Correção:** Adicionar parâmetro `p_skip_intent_log` ou simplesmente confiar que são eventos diferentes (Notificar = sinal, WhatsApp = ação) e adicionar coluna `event_type` futura — por ora, deixar como está mas **documentar** que são eventos distintos.

### 🟠 BUG 3 — `notify_marketplace_interest` não checa `is_active` do user_role

**Arquivo:** mesma migration, linhas 44–50

```sql
JOIN user_roles ur ON ur.user_id = pr.user_id
WHERE pr.organization_id = v_org_id
  AND ur.role IN ('admin', 'sub_admin')
```

Não filtra usuários desativados / perfis suspensos. Notifica admins ex-funcionários.

**Correção:** Adicionar `AND COALESCE(pr.is_active, true) = true` (verificar nome real da coluna).

### 🟡 BUG 4 — AcceptInvite: `useEffect` re-dispara aceitação

**Arquivo:** `src/pages/AcceptInvite.tsx` linha 130–135

```tsx
useEffect(() => {
  if (user && invite && !accepted && !isSubmitting && !acceptAttempted.current) {
    acceptAttempted.current = true;
    acceptInvite();
  }
}, [user, invite]);
```

Faltam `accepted` e `isSubmitting` nas deps. Em StrictMode (dev), o efeito roda 2x; o ref protege, mas se o usuário clicar "Tentar novamente" (linha 346 reseta o ref) **enquanto** uma aceitação ainda está rodando (`isSubmitting=true`), o ref é zerado e a próxima mudança de `user`/`invite` dispara dupla execução.

**Correção:** Adicionar `accepted, isSubmitting` ao array de dependências e proteger o botão "Tentar novamente" com `disabled={isSubmitting}`.

### 🟡 BUG 5 — QuickFormDialog: `filledCount` ignora 0 legítimo

**Arquivo:** `src/components/financing/QuickFormDialog.tsx` linha 103–105

```tsx
const filledCount = Object.values(values).filter(
  (v) => v !== "" && v !== undefined && v !== null && v !== 0,
).length;
```

Trata `0` como vazio. Para `downPayment = 0` (entrada zero é válida) ou `propertyValue = 0` durante digitação, o aviso amarelo aparece incorretamente. Mas pior: no `handleChange` linha 112, `raw === ""` vira `0`, **eliminando** a possibilidade de "campo intocado" vs "campo zerado".

**Correção:** Mudar `handleChange` para guardar `undefined` quando vazio (`raw === "" ? undefined : Number(raw)`) e remover `v !== 0` do filtro.

### 🟡 BUG 6 — FormulariosSection: botão "Pipeline" no banner é no-op

**Arquivo:** `src/components/financing/CorrespondenteTab.tsx` linha 152

```tsx
<button onClick={() => {}} className="text-primary underline-offset-2 hover:underline …">Pipeline</button>
```

`onClick={() => {}}` — clicar não faz nada.

**Correção:** Levantar o `setActive` via prop ou usar contexto, ou simplesmente mudar para texto sem ação clicável.

### 🟡 BUG 7 — FinancingSimulator: custos extras não entram no CET/parcela

**Arquivo:** `src/components/financing/FinancingSimulator.tsx` linhas 50–56

`custosAdicionais` é calculado e exibido no badge, mas **não é somado** ao financiamento, parcela, custo total nem CET. Para o usuário que quer simular "custo real da operação" (motivo do pedido), é meio caminho: mostra o número mas não impacta nenhum cálculo. Se intencional, ok; se esperado refletir no total → bug.

**Correção sugerida:** Somar em `custoTotal = parcelasTotais + custosAdicionais` e exibir linha "Custo total da operação (com extras)".

### 🟢 Ponto de melhoria 8 — DocsChecklist: estado não persiste

`FinancingDocsChecklist` usa `useState` para o `Set<string>` de documentos marcados. Ao trocar de aba (`Pipeline` → `Documentação`) tudo é zerado. Não é bug funcional, mas frustra.

**Correção:** Persistir em `localStorage` por org/cliente.

---

### Plano de execução (ordem de prioridade)

1. **BUG 1** (crítico, quebra UX do marketplace) — refatorar fallback do `ContactDialog` para basear em `hasPhone`.
2. **BUG 6** (quebrado visível) — passar `setActive` para `FormulariosSection` ou converter em texto.
3. **BUG 4** (duplicação intermitente) — corrigir deps do `useEffect` e desabilitar botão.
4. **BUG 5** (aviso falso) — usar `undefined` para campos intocados.
5. **BUG 3** (segurança) — migration adicionando filtro `is_active` em `notify_marketplace_interest`.
6. **BUG 7** (decisão produto) — somar custos extras ao total. Posso aplicar direto.
7. **Melhoria 8** — persistir checklist em localStorage.

BUG 2 fica documentado mas sem mudança imediata (são eventos semanticamente distintos).

Tudo client-side exceto BUG 3 (nova migration pequena). Sem mudanças de schema, sem RLS afetada.

