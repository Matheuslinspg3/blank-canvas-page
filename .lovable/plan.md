

# Plano: Nova Aba "Métricas & Estimativas" no Dashboard

## Visão Geral

Criar uma nova página `/metricas` acessível pela sidebar, contendo 6 seções de métricas com filtro global de período, gráficos Recharts, skeleton loading e exportação PDF. Todos os dados vêm das tabelas existentes no Supabase (leads, properties, contracts, commissions, property_visits, lead_interactions, property_types, property_status_history, profiles).

## Estrutura de Arquivos

```text
src/pages/MetricsDashboard.tsx              — Página principal com filtro + 6 seções
src/hooks/useMetricsData.ts                 — Hook central que busca dados via queries
src/components/metrics/MetricsPeriodFilter.tsx
src/components/metrics/LeadMetricsSection.tsx
src/components/metrics/SalesMetricsSection.tsx
src/components/metrics/PropertyMetricsSection.tsx
src/components/metrics/CostRevenueSection.tsx
src/components/metrics/BrokerRankingSection.tsx
src/components/metrics/MetricCard.tsx        — Card reutilizável com skeleton
src/components/metrics/MetricsSalesFunnel.tsx — Funil visual Leads→Fechamento
src/components/metrics/ExportPdfButton.tsx   — Botão de exportação PDF
```

## Alterações em Arquivos Existentes

1. **`src/App.tsx`** — Adicionar rota `/metricas` com lazy load
2. **`src/components/AppSidebar.tsx`** — Adicionar item "Métricas" no `mainItems` com ícone `BarChart3`
3. **`src/components/MobileBottomNav.tsx`** — Incluir no menu mobile (opcional, se couber)
4. **`src/components/GlobalCommandPalette.tsx`** — Adicionar atalho

## Detalhes Técnicos por Seção

### 1. Filtro Global
- Reutiliza padrão do `useDashboardPeriod` existente, mas com opções: Mês atual, Mês anterior, 3 meses, 6 meses, 1 ano, Customizado
- Componente `ToggleGroup` + `Calendar` range picker (mesmo padrão do `DashboardPeriodFilter`)

### 2. Métricas de Leads
- Queries na tabela `leads` filtradas por `created_at` no período + `organization_id`
- Agrupamento por `source`, `stage`, `temperature`
- Taxa de conversão: `fechado_ganho / (fechado_ganho + fechado_perdido)`
- Tempo médio de resposta: `lead_interactions` com `type='whatsapp'|'ligacao'` MIN `occurred_at` - `leads.created_at`
- Gráfico de linha (Recharts `LineChart`): leads por semana/mês

### 3. Métricas de Vendas
- Tabela `contracts` (type='venda' status='ativo') e `properties` (status='vendido'/'alugado')
- Valor total: SUM `contracts.value`
- Ticket médio: AVG
- Negócios perdidos: leads com `stage='fechado_perdido'` + SUM `estimated_value`
- Funil visual: `BarChart` horizontal com estágios do lead_stages

### 4. Métricas de Imóveis
- `properties` filtradas por org
- Adicionados: `created_at` no período
- Removidos: `property_status_history` com `new_status='inativo'` no período
- Por tipo: JOIN `property_types` → `PieChart`
- Por status: agrupamento por `status`
- Top 5 mais visualizados: `property_visits` COUNT por property_id
- Tempo médio em carteira: diferença entre `created_at` e data de venda/locação (via `property_status_history`)

### 5. Estimativa de Custos & Receita
- Comissão: SUM `commissions.amount` no período
- Campos editáveis (custo por lead, ROI) armazenados em `localStorage` (sem nova tabela)
- Projeção: média dos últimos 3 meses de comissões

### 6. Métricas de Corretores
- Reutiliza lógica do `useDashboardRanking` existente
- Rankings por leads atendidos, negócios fechados
- Taxa de conversão individual
- Exibido apenas para `isAdminOrAbove`

### Exportação PDF
- Usar `html2canvas` + `jspdf` para capturar a página e gerar PDF
- Botão no topo da página

### Performance
- Todas as queries com `staleTime: 60_000`
- Seções abaixo do fold wrapped em `LazySection` (IntersectionObserver)
- Gráficos Recharts lazy-loaded via `React.lazy`

### Layout
- Grid responsivo: `grid-cols-2 lg:grid-cols-4` nos cards
- Seções separadas por `<hr className="section-divider" />`
- Skeleton loading em todos os cards via `isLoading` prop

## Sem Migrações de Banco
Todos os dados necessários já existem nas tabelas atuais. As queries serão feitas client-side via Supabase SDK. Campos editáveis de custos ficam em localStorage.

