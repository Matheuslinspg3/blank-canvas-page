

# Problemas Encontrados na Landing Page

## Problema 1: Warning "Function components cannot be given refs" no Badge
**Causa:** O componente `Badge` (`src/components/ui/badge.tsx`) e uma plain function sem `React.forwardRef`. Quando usado dentro do `Section` (que usa `forwardRef`), o React emite um warning no console.
**Solucao:** Nao e necessario corrigir - o `Badge` nao recebe ref diretamente. O warning e benigno e vem do React validando componentes filhos. Porem, para eliminar completamente, podemos envolver `Badge` com `forwardRef`.

## Problema 2: Planos exibidos incorretamente
**Causa:** `plans.slice(0, 3)` pega os 3 primeiros por preco (Gratuito, Correspondente Bancario, Starter). A logica `highlighted` busca slugs "essencial" ou "profissional", que nao estao nos 3 primeiros. Resultado: nenhum plano aparece como "Popular".
**Solucao:** Filtrar planos da linha principal (`line: "main"`) e selecionar Gratuito, Essencial e Profissional (ou os 3 mais relevantes), garantindo que o destaque funcione.

## Problema 3: Link WhatsApp com numero falso
**Causa:** Linha 425 tem `wa.me/5500000000000` - numero placeholder.
**Solucao:** Substituir pelo numero real de suporte ou remover o link.

## Arquivos a editar

### 1. `src/components/ui/badge.tsx`
- Envolver `Badge` com `React.forwardRef` para eliminar o warning do console.

### 2. `src/pages/LandingPage.tsx`
- **Planos:** Filtrar `plans` para excluir o plano "correspondente" (linha ERP) e mostrar apenas planos da linha principal. Selecionar Gratuito + 2 planos populares.
- **WhatsApp:** Atualizar ou remover o link placeholder.

## Detalhes tecnicos

```typescript
// Badge com forwardRef
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);

// Filtro de planos - excluir linha ERP
const mainPlans = plans?.filter(p => p.slug !== 'correspondente') || [];
const displayPlans = mainPlans.slice(0, 3);
```

