

## Revisao Completa de UX/UI Mobile

### Escopo
Apenas alteracoes de CSS/Tailwind — zero mudancas em logica de negocio, queries ou hooks.

---

### Fase 1: Pagina /planos (prioridade maxima)

**Arquivo: `src/pages/Plans.tsx`**

1. **Cards empilhados em mobile**: Substituir o layout atual `flex overflow-x-auto ... md:grid md:grid-cols-3 lg:grid-cols-6` por `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`. Remover `min-w-[280px]`, `snap-center`, `overflow-x-auto`, `snap-x snap-mandatory`.

2. **Destaque do plano atual**: Adicionar ao card do plano ativo: `ring-2 ring-primary shadow-primary/20 shadow-lg` (similar ao highlighted mas com glow sutil).

3. **Header responsivo**: No banner do plano ativo (linha 265), adicionar `flex-col sm:flex-row` e `text-center sm:text-left` para empilhar verticalmente em mobile. Botao "Gerenciar assinatura" com `w-full sm:w-auto`.

4. **Toggle breathing room**: Adicionar `my-6` ao container do toggle mensal/anual.

5. **Feature list spacing**: Na lista de features (linha 393), mudar de `space-y-2` para `space-y-2.5` e adicionar `py-1` em cada item para melhor tap target.

6. **Addons grid**: Mudar `sm:grid-cols-3` para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

7. **Comparison table**: Ja tem `overflow-x-auto` — adicionar indicador visual com gradiente na borda direita.

---

### Fase 2: Revisao global de responsividade

**Principios aplicados em todos os arquivos:**

| Padrao | Correcao |
|--------|----------|
| `grid-cols-2` sem breakpoint mobile | Adicionar `grid-cols-1 sm:grid-cols-2` onde o conteudo for complexo demais para 2 colunas em 320px |
| Botoes de acao | Adicionar `min-h-[44px]` nos botoes principais (tap target iOS) |
| Dialogs/modals | Garantir `max-w-[calc(100vw-2rem)]` e `max-h-[calc(100vh-2rem)]` em mobile |
| Padding geral | Verificar `px-4` minimo em containers principais |

**Arquivos especificos:**

8. **Dashboard (`src/pages/Dashboard.tsx`)**: Ja tem `hidden md:grid` para stats — OK. Verificar `p-4 sm:p-6` — OK.

9. **KanbanBoard (`src/components/crm/KanbanBoard.tsx`)**: O skeleton usa `grid-cols-2 lg:grid-cols-4` — OK para mobile. Verificar que o board horizontal tem scroll adequado.

10. **Properties grid**: Buscar o componente de listagem de imoveis e garantir `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

11. **Financial page**: TabsList ja foi corrigida com scroll horizontal. Verificar padding interno das tabs.

12. **PropertyForm**: Verificar que inputs em grid-cols-2 viram grid-cols-1 em mobile.

13. **Settings page**: Verificar layout de formularios.

14. **SimulationResults**: `grid-cols-4` no TabsList — adicionar `overflow-x-auto` e `shrink-0` nos triggers. `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` para metric cards — OK.

15. **CheckoutDialog**: `grid-cols-2` para periodo e pagamento — OK pois sao so 2 botoes pequenos.

16. **CustomPlanBuilder**: `sm:grid-cols-2` — OK, ja responsivo.

17. **InvoiceForm**: `grid-cols-2` em formulario — adicionar `grid-cols-1 sm:grid-cols-2`.

---

### Fase 3: Componentes globais

18. **Dialogs gerais**: No `dialog.tsx` do shadcn, verificar que `DialogContent` tem padding adequado e `max-w` responsivo.

19. **Tables**: Nos componentes de tabela, garantir `overflow-x-auto` no container wrapper.

20. **Fixed/sticky elements**: Verificar que `AppBottomNav` nao sobrepoe conteudo — ja tem `pb-20` no `AppMobileLayout`.

---

### Arquivos modificados (estimativa)

| Arquivo | Tipo de mudanca |
|---------|----------------|
| `src/pages/Plans.tsx` | Layout cards, header, addons, toggle |
| `src/components/financial/InvoiceForm.tsx` | Grid responsivo |
| `src/components/financing/SimulationResults.tsx` | TabsList scroll |
| `src/pages/Properties.tsx` ou grid component | Grid responsivo |
| `src/components/settings/*` | Forms grid responsivo |
| ~5-10 outros componentes com grid-cols problematicos | `grid-cols-1` em mobile |

Nenhuma mudanca em hooks, queries, contextos ou logica de negocio.

