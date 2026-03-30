

## Fix: Aba Financiamentos não aparece na UI do Financeiro

### Problema
A `TabsList` do Financeiro tem 6 abas (Transações, Cobranças, Comissões, Contratos, Templates, Financiamentos) dentro de um container `inline-flex` sem scroll horizontal. No mobile, as abas ficam comprimidas e "Financiamentos" é cortada ou invisível. No desktop, com `w-full`, as 6 abas dividem o espaço igualmente, também ficando apertadas.

### Solução
Tornar a `TabsList` scrollável horizontalmente, especialmente no mobile:

**Arquivo: `src/pages/Financial.tsx` (linha 238)**

1. Trocar a classe da `TabsList` de `w-full sm:w-auto` para `w-full overflow-x-auto flex-wrap sm:flex-nowrap sm:w-auto` para permitir scroll/wrap
2. Remover `flex-1` dos `TabsTrigger` no mobile (que força divisão igual) e usar `shrink-0` para que cada aba mantenha seu tamanho mínimo
3. Alternativamente, agrupar as abas em duas linhas no mobile: financeiras (Transações, Cobranças, Comissões) e documentais (Contratos, Templates, Financiamentos)

**Abordagem recomendada — scroll horizontal no mobile:**

```tsx
<TabsList className="w-full sm:w-auto overflow-x-auto scrollbar-hide">
  <TabsTrigger value="transactions" className="shrink-0 min-h-[44px]">Transações</TabsTrigger>
  <TabsTrigger value="invoices" className="shrink-0 min-h-[44px]">...</TabsTrigger>
  <TabsTrigger value="commissions" className="shrink-0 min-h-[44px]">Comissões</TabsTrigger>
  <TabsTrigger value="contracts" className="shrink-0 min-h-[44px] gap-2">...</TabsTrigger>
  <TabsTrigger value="templates" className="shrink-0 min-h-[44px] gap-2">...</TabsTrigger>
  <TabsTrigger value="financiamentos" className="shrink-0 min-h-[44px] gap-2">...</TabsTrigger>
</TabsList>
```

Também adicionar a classe utilitária `scrollbar-hide` no Tailwind config (ou usar `[&::-webkit-scrollbar]:hidden`) para esconder a barra de scroll.

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `src/pages/Financial.tsx` | TabsList scrollável + TabsTriggers com `shrink-0` |
| `src/index.css` | Adicionar `.scrollbar-hide` se não existir |

