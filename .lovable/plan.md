

## Correção: Warning de ref no componente Section

### Problema
O console mostra: *"Function components cannot be given refs"* para o componente `Section` em `LandingPage.tsx`. Isso acontece porque `Section` é uma função simples e não usa `React.forwardRef`.

### Solução
Envolver o componente `Section` com `React.forwardRef` para aceitar refs corretamente.

### Arquivo a editar
- `src/pages/LandingPage.tsx` — linha 25: converter `Section` para usar `forwardRef`

### Mudança
```tsx
const Section = React.forwardRef<HTMLElement, { children: React.ReactNode; className?: string; id?: string }>(
  ({ children, className, id }, ref) => (
    <section ref={ref} id={id} className={cn("py-16 md:py-24 px-4", className)}>
      <div className="container max-w-6xl mx-auto">{children}</div>
    </section>
  )
);
Section.displayName = "Section";
```

### Impacto
- Elimina o warning do console
- Zero impacto visual ou funcional

