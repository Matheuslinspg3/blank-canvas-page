

## Plano: Melhorar Extração de Imóveis via PDF

### Problemas Identificados

1. **Descrições secas**: O prompt atual pede apenas campos estruturados sem instruir a IA a gerar descrições ricas com lazer, condições de pagamento, diferenciais do empreendimento.
2. **Poucos imóveis detectados**: O PDF tem ~20+ unidades individuais (ex: Chopin 63B, 64A, 64B; Ilha da Madeira unidades 71, 111, 131, etc.), mas a IA está agrupando por edifício, retornando apenas 5.

### Alterações

**Arquivo**: `supabase/functions/extract-property-pdf/index.ts`

1. **Reescrever o `EXTRACT_PROMPT`** (linha 126-149) para:
   - Instruir explicitamente que cada **unidade** é um imóvel separado (ex: "Unidade 63B" e "Unidade 64A" do mesmo edifício devem ser 2 imóveis distintos)
   - Pedir descrições ricas e completas incluindo: nome do empreendimento, lazer, acabamentos, condições de pagamento (à vista vs financiamento), status das chaves/obra
   - Incluir o campo `unit` para o número da unidade
   - Incluir `price_cash` e `price_financed` como campos separados
   - Pedir que o `title` inclua o nome do empreendimento + unidade (ex: "Res. Frédéric François Chopin - Unidade 63B")
   - Instruir que a `description` deve ser um texto comercial completo com todas as informações disponíveis: lazer, localização, metragem, diferenciais

2. **Atualizar `normalizeExtractedProperties`** para mapear os novos campos (`price_cash`, `price_financed`) para o campo `price` existente (usar o menor valor como referência), e manter as infos extras na description.

### Resultado Esperado

- O mesmo PDF passará a retornar ~20+ imóveis (um por unidade)
- Cada imóvel terá uma descrição comercial completa com lazer, condições e diferenciais
- O título identificará claramente cada unidade

