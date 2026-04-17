

## Plano — Gerar Formulários Bancários sem precisar do Pipeline

### Problema
Em `Correspondente → Formulários`, hoje o usuário só vê um **catálogo informativo**. A mensagem diz "para usar, crie um processo no Pipeline e clique em Formulários". Isso obriga um cadastro completo no Kanban só para gerar 1 PDF — fricção desnecessária para uso pontual (cliente avulso, simulação rápida, prova de conceito).

### Solução — Modo "Geração Avulsa" (ad-hoc)

Transformar a aba **Formulários** em uma ferramenta funcional, mantendo 100% de compatibilidade com o fluxo Pipeline existente.

**Fluxo novo:**
1. Usuário abre `Formulários` → vê os bancos com seus formulários, cada um com botão **"Preencher e gerar"**.
2. Clica → abre `QuickFormDialog` (novo) com os campos mínimos necessários para aquele formulário específico.
3. Preenche → clica **"Gerar PDF"** → reusa `generateBankForm()` existente → download imediato.
4. Banner discreto no topo: *"Quer salvar este cliente? Crie um processo no Pipeline."* (link opcional, não bloqueante).

### Arquivos

**1. `src/components/financing/QuickFormDialog.tsx`** (novo, ~150 linhas)
- Dialog reutilizável que recebe `bankCode` + `formId` + `formName`.
- Campos agrupados por seção (Cliente / Imóvel / Financiamento) usando os mesmos componentes shadcn.
- **Schema dinâmico por tipo de formulário** (mapa interno):
  - `*_proposta` → todos os campos
  - `*_saude` (DPS) → só dados pessoais básicos
  - `caixa_fgts` → dados pessoais + imóvel
  - `*_ficha` / `*_declaracao` → cadastro completo
- Validação leve (Zod) com **defaults seguros** vindos de `EMPTY_FORM`.
- Botão "Gerar PDF" chama `generateBankForm({ ...EMPTY_FORM, ...formData, id: crypto.randomUUID(), stage: "ad_hoc", createdAt: new Date() }, formId)`.

**2. `src/components/financing/CorrespondenteTab.tsx`** (refator de `FormulariosSection`, linhas 134-169)
- Cada formulário vira um card clicável com botão `Preencher e gerar`.
- Banner informativo no topo com link "Ir para Pipeline" (sem forçar).
- Mantém o catálogo visual atual, só adiciona ação.

**3. `src/components/financing/BankFormGenerator.ts`** (1 ajuste defensivo)
- Função `generateBankForm` já tolera campos vazios (linha 50: `value || "________"`). Só vamos **garantir defaults** quando `proc.id` for curto: usar `proc.id?.slice(0,8) ?? "AVULSO"` para não quebrar.

### Fallbacks & Guardrails

**Fallback 1 — Campos vazios não quebram o PDF**
`BankFormGenerator` já desenha `________` para valores ausentes. Confirmado nas linhas 91, 116, 50 do gerador. O usuário pode gerar mesmo com 1 campo só preenchido (ex: nome do cliente).

**Fallback 2 — `formId` desconhecido**
Já existe `default: generateProposta(proc, bankCode)` no switch (linha ~340). Se o ID for novo/desconhecido, gera proposta genérica em vez de quebrar.

**Fallback 3 — jsPDF indisponível / erro de geração**
Wrap com `try/catch` (já está no `BankFormDialog` linha 21-28, replicar no `QuickFormDialog`). Mostra `toast.error("Erro ao gerar formulário")` em vez de tela branca.

**Fallback 4 — Validação opcional, não obrigatória**
Zod schema marca **todos os campos como `.optional()`**. O usuário pode gerar PDF mesmo "em branco" (útil para imprimir formulário em branco e preencher à mão). Apenas exibe aviso visual amarelo se < 3 campos preenchidos: *"PDF será gerado com campos em branco para preenchimento manual."*

**Guardrails (impedir falha logo de início):**
- **G1 — Sanitização do nome do arquivo:** `proc.clientName.replace(/\s/g, "_")` já existe; adicionar `|| "cliente_avulso"` para evitar `cliente_.pdf` quando vazio.
- **G2 — `crypto.randomUUID()` sempre disponível:** fallback `Date.now().toString()` para ambientes sem `crypto`.
- **G3 — Comentário JSDoc** em `QuickFormDialog`: *"Modo ad-hoc — não persiste em DB. Para histórico, usar Pipeline."*
- **G4 — Telemetria leve:** `console.info("[corban] form_generated", { bankCode, formId, mode: "ad_hoc" })` para futuro acompanhamento de adoção.
- **G5 — Mobile-first:** Dialog `max-w-2xl` + `max-h-[90vh] overflow-y-auto` para funcionar bem em telas pequenas (segue padrão do projeto).

### Resultado
- Usuário gera formulários **sem nenhum cadastro no Pipeline**.
- Pipeline continua sendo o caminho recomendado para gestão recorrente (link no banner).
- 5 fallbacks garantem que mesmo entradas vazias / parciais / inválidas produzam algo útil.
- Zero alterações em DB, edge functions ou RLS — feature 100% client-side.

