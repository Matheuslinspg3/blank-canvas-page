

## Revisao Completa de UX/UI Mobile — Fase 2

O plano anterior ja corrigiu Plans.tsx (cards empilhados, destaque ativo, header responsivo). Agora o foco e na pagina /financeiro e nos componentes globais restantes.

---

### 1. Pagina /financeiro — Summary Cards

**Arquivo: `src/pages/Financial.tsx` (linha 187)**

Atual: `grid-cols-2 md:grid-cols-4` — em 320px os cards ficam apertados e cortados.

Correcao: Em telas muito pequenas, mostrar 1 coluna; a partir de ~380px, 2 colunas:
```
grid-cols-1 xs:grid-cols-2 md:grid-cols-4
```
Como Tailwind nao tem `xs:` por padrao, usar `min-[380px]:grid-cols-2` ou manter `grid-cols-2` e reduzir padding interno dos cards com `p-2 sm:p-3`. Tambem reduzir `text-2xl` para `text-xl sm:text-2xl` nos valores.

### 2. Pagina /financeiro — Tabs scroll indicator

**Arquivo: `src/pages/Financial.tsx` (linha 238)**

A TabsList ja tem `overflow-x-auto` e `shrink-0`, mas falta indicador visual. Adicionar um wrapper `relative` com pseudo-gradiente na borda direita via classe utilitaria:

```tsx
<div className="relative">
  <TabsList className="w-full sm:w-auto overflow-x-auto scrollbar-hide flex-nowrap justify-start">
    ...
  </TabsList>
  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
</div>
```

### 3. CashFlowChart — Empty state compacto em mobile

**Arquivo: `src/components/financial/CashFlowChart.tsx` (linha 52)**

Reduzir `h-[300px]` para `h-[180px] sm:h-[300px]`, icone de `w-16 h-16` para `w-12 h-12 sm:w-16 sm:h-16`, e `mb-4` para `mb-2 sm:mb-4`.

### 4. Pagina /financeiro — Botao "Nova Transacao" visivel

**Arquivo: `src/pages/Financial.tsx` (linha 177)**

O botao ja existe no PageHeader `actions` mas pode ser truncado. Garantir que em mobile o texto "Nova Transacao" aparece (ja aparece). Verificar que o PageHeader nao esconde o botao — o layout atual (`flex items-center`) ja funciona.

### 5. Contract stats grid

**Arquivo: `src/pages/Financial.tsx` (linha 294)**

Atual: `grid-cols-2 sm:grid-cols-4` — OK para 4 items pequenos em mobile. Manter.

### 6. Componentes globais restantes com grid-cols-2

Arquivos a corrigir (mesma logica — adicionar `grid-cols-1 sm:grid-cols-2` ou reduzir padding):

| Arquivo | Linha aprox | Atual | Correcao |
|---------|-------------|-------|----------|
| `src/pages/ImportPendencies.tsx` | 191, 217 | `grid-cols-2 md:grid-cols-4` | Manter — sao cards pequenos de stats |
| `src/pages/Contracts.tsx` | 114 | `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` | OK ja responsivo |
| `src/components/automations/AutomationStats.tsx` | 31 | `grid-cols-2 sm:grid-cols-5` | OK |

### 7. Comparison table gradient (Plans.tsx)

**Arquivo: `src/pages/Plans.tsx` (linha 472)**

Adicionar wrapper com gradiente de scroll similar ao item 2:

```tsx
<div className="relative">
  <div className="overflow-x-auto border rounded-xl">
    <table>...</table>
  </div>
  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden rounded-r-xl" />
</div>
```

---

### Resumo de arquivos a editar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Financial.tsx` | Summary cards padding, tabs gradient wrapper |
| `src/components/financial/CashFlowChart.tsx` | Empty state compacto mobile |
| `src/pages/Plans.tsx` | Comparison table gradient indicator |

Apenas CSS/Tailwind — zero mudancas em logica.

