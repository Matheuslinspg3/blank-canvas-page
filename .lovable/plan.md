

## Reajuste de Preços — Planos Porta do Corretor

### Tabela Final Completa

| Plano | Preço Atual | Novo Preço | Anual (×10) |
|-------|------------|------------|-------------|
| Gratuito | R$ 0 | R$ 0 | R$ 0 |
| Starter | R$ 59,90 | **R$ 99,90** | R$ 999,00 |
| Correspondente | R$ 79,90 | **R$ 119,90** | R$ 1.199,00 |
| Essencial | R$ 129,90 | **R$ 179,90** | R$ 1.799,00 |
| Profissional | R$ 299,90 | **R$ 299,90** (mantém) | R$ 2.999,00 |
| Business | R$ 499,90 | **R$ 599,90** | R$ 5.999,00 |
| Enterprise | R$ 499,90 | **R$ 679,90** | R$ 6.799,00 |

### Implementação

Uma única operação UPDATE na tabela `subscription_plans` usando a ferramenta de insert (não é migração, é atualização de dados):

```sql
UPDATE subscription_plans SET price_monthly = 9990, price_yearly = 99900 WHERE slug = 'starter';
UPDATE subscription_plans SET price_monthly = 11990, price_yearly = 119900 WHERE slug = 'correspondente';
UPDATE subscription_plans SET price_monthly = 17990, price_yearly = 179900 WHERE slug = 'essencial';
UPDATE subscription_plans SET price_monthly = 29990, price_yearly = 299900 WHERE slug = 'profissional';
UPDATE subscription_plans SET price_monthly = 59990, price_yearly = 599900 WHERE slug = 'business';
UPDATE subscription_plans SET price_monthly = 67990, price_yearly = 679900 WHERE slug = 'enterprise';
```

Valores em centavos conforme convenção do banco. Nenhuma alteração de código necessária — frontend já lê preços dinamicamente.

### Impacto
- Assinaturas existentes: afetadas apenas na renovação/upgrade
- Novos usuários: veem preços novos imediatamente
- Enterprise agora tem preço diferenciado do Business (antes eram iguais)

