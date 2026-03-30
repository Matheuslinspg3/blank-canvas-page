

## Adicionar Plano Personalizado na pagina /planos

O componente `CustomPlanBuilder` ja existe e funciona dentro do `PlanCatalogDialog` (configuracoes). O objetivo e integra-lo diretamente na pagina `/planos`, visivel para todos os usuarios, como uma secao dedicada abaixo dos cards de planos principais.

---

### Implementacao

**Arquivo: `src/pages/Plans.tsx`**

1. Importar o componente `CustomPlanBuilder` de `@/components/billing/CustomPlanBuilder`

2. Adicionar uma nova secao entre os cards de planos e a tabela de comparacao (antes da linha 461), com:
   - Separador visual com titulo "Monte seu Plano Personalizado"
   - Subtitulo explicativo: "Escolha apenas os modulos que voce precisa"
   - O componente `<CustomPlanBuilder />` renderizado dentro de um container com `max-w-5xl mx-auto px-4`

A secao tera este formato:

```tsx
{/* CUSTOM PLAN BUILDER */}
<section className="max-w-5xl mx-auto px-4 pb-16">
  <Separator className="mb-8" />
  <CustomPlanBuilder />
</section>
```

O `CustomPlanBuilder` ja possui:
- Header proprio ("Monte seu Plano")
- Toggle mensal/anual
- Cards de modulos por categoria (gestao, marketing, IA, integracao)
- Controle de quantidade para modulos numericos
- Resumo com preco total
- Integracao com `CheckoutDialog` para pagamento via Asaas

**Nenhuma mudanca em logica, queries ou hooks** — apenas 1 import e ~5 linhas de JSX.

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Plans.tsx` | Import + secao com `<CustomPlanBuilder />` |

