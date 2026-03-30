

## Problema: View do Marketplace quebrada por tipo enum

### Diagnóstico
A view `marketplace_properties_public` é alimentada pela função `get_marketplace_properties_public()`. Essa função declara `transaction_type text` e `status text` no retorno, mas as colunas reais na tabela `marketplace_properties` são do tipo enum (`transaction_type` e `property_status`). Isso causa erro de tipo e a view retorna zero resultados.

Existem **1.102 imóveis disponíveis** no banco, mas nenhum aparece porque a view falha silenciosamente.

### Solução
Criar uma migration que recria a função com casts explícitos `::text` nos campos enum:

**Arquivo: Nova migration SQL**
- `DROP VIEW` e `DROP FUNCTION` existentes
- Recriar `get_marketplace_properties_public()` com `mp.transaction_type::text` e `mp.status::text` no SELECT
- Recriar a view e manter os GRANTs

### Alteração específica

```sql
-- No SELECT da função, mudar:
mp.transaction_type,   -->  mp.transaction_type::text,
mp.status,             -->  mp.status::text,
```

Nenhuma alteração no frontend é necessária — o código já funciona, só precisa da view retornando dados corretamente.

