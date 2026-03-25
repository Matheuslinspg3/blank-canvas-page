

# Plano: Simulador de Financiamento Imobiliário Realista

## Situacao Atual

O simulador existente faz calculos basicos (SAC/PRICE) sem seguros MIP/DFI, sem taxa administrativa, sem TR, sem idade do comprador, sem CET. A interface usa inputs de texto simples sem sliders. O modulo ja esta integrado como sub-aba em Financeiro.

## O Que Muda

Reconstruir o motor de calculo e a interface do simulador para incluir todos os custos reais de um financiamento imobiliario brasileiro: seguros obrigatorios (MIP por faixa etaria, DFI), taxa administrativa, TR do BCB, CET estimado, validacao por idade, e FGTS na entrada.

---

## Etapas de Implementacao

### 1. Constantes e Tabelas (novos arquivos)

- `src/constants/bancos-financiamento.ts` — 6 bancos com taxas atuais, taxa admin, cores, teto SFH (R$ 2.25M), limites
- `src/constants/tabela-mip.ts` — tabela de aliquotas MIP por faixa etaria (11 faixas, 18-80 anos) + aliquota DFI fixa

### 2. Hook da Taxa Referencial (TR)

- `src/hooks/useTaxaReferencial.ts` — busca serie 7811 do BCB (TR mensal), staleTime 24h, fallback 0.1690%

### 3. Motor de Calculo Completo

- Reescrever `src/components/financing/utils/simulationCalc.ts`:
  - Taxa mensal efetiva = taxa base + TR
  - Parcela SAC e PRICE com MIP (avanca idade ao longo do contrato), DFI, taxa admin
  - Calculo do CET por busca binaria
  - Retorna `ResultadoSimulacao` completo com evolucao mes a mes
  - Validacao de idade (prazo maximo = 80.5 - idade)
  - Renda minima e comprometimento de 30%

### 4. Interface Reformulada

- Reescrever `src/components/financing/FinancingSimulator.tsx`:
  - **Formulario**: sliders + inputs para valor do imovel, % entrada, prazo (anos), renda, idade, sistema SAC/PRICE, toggle FGTS
  - **Badges informativos**: SFH/SFI, valor entrada, financiado, prazo maximo por idade, status aprovacao
  - **Grid de bancos**: cards com cor do banco, taxa + TR, 1a parcela total (com seguros), CET, destaque no mais economico, economia vs mais caro. Card clicavel para selecionar banco

- Novo `src/components/financing/BankComparisonView.tsx` (reescrito):
  - Cards rankeados com cores dos bancos
  - Tabela comparativa com CET, seguros, taxa admin

- Novo `src/components/financing/SimulationResults.tsx`:
  - **Aba Resumo**: cards de metricas + grafico donut da composicao da 1a parcela + barra de custo total
  - **Aba Evolucao**: tabela com primeiros 12 meses + marcos a cada 5 anos + ultimo mes, botao expandir
  - **Aba Analise de Renda**: gauge de comprometimento, marca 30%, sugestoes se reprovado, comparativo SAC vs PRICE
  - **Aba Custos Extras**: ITBI, escritura, registro, avaliacao estimados

### 5. Componentes Reutilizaveis

- `CurrencyInput` — input com mascara monetaria pt-BR
- `PercentSlider` — slider com label de percentual

### 6. Migration Supabase — Tabela de Simulacoes

```sql
CREATE TABLE simulacoes_financiamento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  imovel_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  valor_imovel NUMERIC NOT NULL,
  valor_entrada NUMERIC NOT NULL,
  valor_fgts NUMERIC DEFAULT 0,
  valor_financiado NUMERIC NOT NULL,
  prazo_meses INTEGER NOT NULL,
  idade_comprador INTEGER NOT NULL,
  renda_mensal NUMERIC NOT NULL,
  sistema_amortizacao TEXT NOT NULL,
  banco_id TEXT NOT NULL,
  taxa_anual NUMERIC NOT NULL,
  tr_mensal NUMERIC NOT NULL,
  primeira_parcela NUMERIC NOT NULL,
  ultima_parcela NUMERIC NOT NULL,
  total_pago NUMERIC NOT NULL,
  total_juros NUMERIC NOT NULL,
  total_seguros NUMERIC NOT NULL,
  cet_anual_estimado NUMERIC NOT NULL,
  comprometimento_renda NUMERIC NOT NULL,
  aprovado BOOLEAN NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: corretor ve apenas suas simulacoes
```

- Botao "Salvar Simulacao" com opcao de vincular a lead/imovel existente

### 7. Gerar PDF

- Botao "Gerar PDF" usando jspdf + html2canvas (ja disponivel no projeto)
- Conteudo: dados do imovel, comprador, resultado completo, tabela de evolucao resumida, comparativo de bancos, disclaimer, dados do corretor (nome, CRECI)

---

## Arquivos Afetados

| Acao | Arquivo |
|------|---------|
| Criar | `src/constants/bancos-financiamento.ts` |
| Criar | `src/constants/tabela-mip.ts` |
| Criar | `src/hooks/useTaxaReferencial.ts` |
| Reescrever | `src/components/financing/utils/simulationCalc.ts` |
| Reescrever | `src/components/financing/FinancingSimulator.tsx` |
| Reescrever | `src/components/financing/BankComparisonView.tsx` |
| Criar | `src/components/financing/SimulationResults.tsx` |
| Criar | `src/components/financing/CurrencyInput.tsx` |
| Criar | `src/components/financing/PercentSlider.tsx` |
| Criar | `src/components/financing/SimulationPdfGenerator.ts` |
| Migration | `simulacoes_financiamento` table + RLS |
| Manter | `src/pages/Financial.tsx` (sem mudancas, ja integra o componente) |

