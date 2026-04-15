

# Reduzir franquia de automação do plano Profissional

## Contexto
O plano **Profissional** (slug: `profissional`, R$ 299,90/mês) possui atualmente uma franquia de automação de **R$ 900,00**. Com markup de 1.5x, o custo real ao usar 100% é R$ 600 — gerando prejuízo de ~R$ 369.

## Alteração

**Passo único**: Atualizar o campo `automation_allowance_brl` de `900.00` para `300.00` na tabela `subscription_plans` para o registro com id `ed05def6-a64e-4839-94f3-54cd33c6bd2b`.

```sql
UPDATE subscription_plans
SET automation_allowance_brl = 300.0000
WHERE id = 'ed05def6-a64e-4839-94f3-54cd33c6bd2b';
```

## Impacto financeiro (uso 100%)
- **Antes**: Custo real R$ 600 → Margem: -R$ 300
- **Depois**: Custo real R$ 200 → Margem: +R$ 100

## Observações
- Nenhuma alteração de código necessária — o valor é lido dinamicamente do banco.
- A renovação mensal de créditos (`automation-monthly-credits`) já usa `automation_allowance_brl` da tabela, então refletirá automaticamente.
- Organizações existentes manterão o saldo atual até a próxima renovação mensal.

