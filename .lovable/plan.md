

# Plano "Correspondente Bancário" - Financiamentos Imobiliários

## Objetivo
Criar um novo plano de assinatura voltado para profissionais de financiamento imobiliário (correspondentes bancários), com funcionalidades específicas para simulação de crédito, gestão de processos de financiamento, acompanhamento de clientes e integração com bancos.

## Novo Plano: "Correspondente"

| Campo | Valor |
|-------|-------|
| **Nome** | Correspondente Bancário |
| **Slug** | `correspondente` |
| **Preço mensal** | R$ 79,90 (7990 centavos) |
| **Preço anual** | R$ 799,00 (79900 centavos) |
| **Trial** | 7 dias |
| **plan_type** | `main` |
| **max_own_properties** | 50 |
| **max_leads** | 500 |
| **max_users** | 3 |

**Features JSON:**
```json
{
  "line": "erp",
  "basic_crm": true,
  "financial": true,
  "financing_simulator": true,
  "financing_pipeline": true,
  "financing_docs_checklist": true,
  "contracts_ai": true,
  "ai_credits_limit": 50,
  "max_storage_mb": 2048,
  "priority_support": false
}
```

## Alterações

### 1. Migration SQL
- Inserir o novo plano `correspondente` na tabela `subscription_plans` com os valores acima
- `display_order` entre Essencial e Profissional (ex: 35)

### 2. UI - Página de Planos (`Plans.tsx`)
- Adicionar entrada em `planMeta` para slug `correspondente` com ícone `Landmark` (banco) e badge "Para Financiamentos"
- O plano aparecerá automaticamente no catálogo pois a query já busca todos os planos ativos

### 3. UI - Página de Cadastro (`Auth.tsx`)
- O plano já aparecerá automaticamente na lista de seleção de planos no cadastro

### 4. Feature Gating
- Adicionar novas feature keys no `useFeatureGate` / `hasFeature`:
  - `financing_simulator` - Simulador de financiamento
  - `financing_pipeline` - Pipeline de processos de financiamento
  - `financing_docs_checklist` - Checklist de documentação

### 5. Novos Componentes (estrutura inicial)
- `src/components/financing/FinancingSimulator.tsx` - Simulador de financiamento (SAC/Price, com entrada, prazo, taxa)
- `src/components/financing/FinancingPipeline.tsx` - Kanban de processos de financiamento (Análise de Crédito → Documentação → Avaliação → Contrato → Liberação)
- `src/components/financing/FinancingDocsChecklist.tsx` - Checklist de documentos necessários por banco/produto

### 6. Nova Rota
- `/financiamentos` - Página principal com tabs: Simulador, Pipeline, Documentação
- Protegida por feature gate `financing_simulator`

## Arquivos criados/modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL (INSERT plano) | Criar |
| `src/pages/Plans.tsx` | Editar (planMeta) |
| `src/pages/Financiamentos.tsx` | Criar |
| `src/components/financing/FinancingSimulator.tsx` | Criar |
| `src/components/financing/FinancingPipeline.tsx` | Criar |
| `src/components/financing/FinancingDocsChecklist.tsx` | Criar |
| `src/App.tsx` | Editar (nova rota) |
| Sidebar/menu | Editar (link para /financiamentos) |

