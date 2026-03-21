

## Reestruturação de Planos: Duas Linhas de Produto

O app tem dois públicos distintos: (1) consumidores/corretores individuais que querem acessar o **Marketplace** e (2) imobiliárias que precisam do **ERP completo**. A proposta cria duas linhas independentes de planos.

---

### Linha 1: MARKETPLACE (Porta do Corretor)

Para corretores independentes e pequenas imobiliárias que querem visibilidade e acesso a imóveis compartilhados.

```text
Plano              Mensal     Anual        O que inclui
───────────────────────────────────────────────────────────────────────────
Visitante          R$0        R$0          Buscar imóveis no marketplace
(gratuito)                                 Ver até 10 detalhes/dia
                                           Favoritar até 20 imóveis
                                           Sem contato do anunciante

Explorador         R$19,90    R$199,00     Busca ilimitada
                                           Ver contato do anunciante
                                           Favoritos ilimitados
                                           Alertas de novos imóveis

Corretor           R$49,90    R$499,00     Tudo do Explorador +
Marketplace                                Publicar até 10 imóveis no marketplace
                                           Perfil público de corretor
                                           Receber leads do marketplace
                                           Landing page básica por imóvel

Corretor           R$89,90    R$899,00     Tudo do Corretor Marketplace +
Marketplace Plus                           Publicar até 50 imóveis
                                           5 artes IA/mês
                                           5 textos IA para anúncios/mês
                                           Destaque nos resultados de busca
                                           Estatísticas de visualização

Agência            R$149,90   R$1.499,00   Tudo do Plus +
Marketplace                                Imóveis ilimitados no marketplace
                                           30 artes IA/mês
                                           30 textos IA/mês
                                           10 landing pages IA/mês
                                           Parcerias entre imobiliárias
                                           Badge "Agência verificada"
                                           Prioridade nos resultados
```

---

### Linha 2: ERP IMOBILIÁRIO (Gestão)

Para imobiliárias que precisam de CRM, financeiro, contratos, equipe e automações.

```text
Plano              Mensal     Anual        O que inclui
───────────────────────────────────────────────────────────────────────────
ERP Starter        R$79,90    R$799,00     CRM Kanban (até 100 leads)
                                           Até 30 imóveis cadastrados
                                           1 usuário
                                           Dashboard básico
                                           Agenda/tarefas

ERP Profissional   R$179,90   R$1.799,00   Tudo do Starter +
                                           Até 500 leads
                                           Até 100 imóveis
                                           5 usuários
                                           Financeiro (contratos, comissões)
                                           20 ações IA/mês (textos, resumos)
                                           WhatsApp integrado
                                           Importação Imobzi
                                           Relatórios

ERP Business       R$297,00   R$2.970,00   Tudo do Profissional +
                                           Até 2.000 leads
                                           Até 300 imóveis
                                           15 usuários
                                           50 ações IA/mês
                                           10 artes IA/mês
                                           Meta Ads + RD Station
                                           Automações (até 5)
                                           Feed XML para portais
                                           Extração de PDF com IA
                                           Preenchimento de contrato IA

ERP Enterprise     R$497,00   R$4.970,00   Tudo do Business +
                                           Leads/imóveis/usuários ilimitados
                                           200 ações IA/mês
                                           50 artes IA/mês
                                           Automações ilimitadas
                                           Suporte prioritário
                                           Log de auditoria
                                           White label
                                           API access
```

---

### Combos (Marketplace + ERP)

Desconto de 20% ao assinar ambas as linhas:

```text
Combo                              De           Por
────────────────────────────────────────────────────
Corretor MP + ERP Starter          R$129,80     R$99,90/mês
Corretor Plus + ERP Profissional   R$269,80     R$219,90/mês
Agência MP + ERP Business          R$446,90     R$357,00/mês
Agência MP + ERP Enterprise        R$646,90     R$497,00/mês
```

---

### Análise de Margem

```text
Plano                  Preço    Custo/org   Margem    Margem %
──────────────────────────────────────────────────────────────
Visitante              R$0      R$0         R$0       N/A
Explorador             R$19,90  ~R$0,50     R$19,40   97%
Corretor MP            R$49,90  ~R$1        R$48,90   98%
Corretor MP Plus       R$89,90  ~R$3        R$86,90   97%
Agência MP             R$149,90 ~R$5        R$144,90  97%
ERP Starter            R$79,90  ~R$1        R$78,90   99%
ERP Profissional       R$179,90 ~R$4        R$175,90  98%
ERP Business           R$297,00 ~R$8        R$289,00  97%
ERP Enterprise         R$497,00 ~R$15       R$482,00  97%
```

Break-even (R$236,67/mês fixo):
- **12 Exploradores** = R$238,80
- **5 Corretores MP** = R$249,50
- **3 ERP Starters** = R$239,70
- **2 ERP Profissionais** = R$359,80

---

### Implementação Técnica

**1. Banco de dados** -- Inserir novos planos na tabela `subscription_plans`:
- Desativar os 4 planos atuais (`is_active = false`)
- Inserir 9 novos planos com slugs: `visitante`, `explorador`, `corretor-mp`, `corretor-mp-plus`, `agencia-mp`, `erp-starter`, `erp-profissional`, `erp-business`, `erp-enterprise`
- Usar campo `features` JSONB para limites granulares:
  ```json
  {
    "line": "marketplace",
    "details_per_day": 10,
    "show_contact": false,
    "max_favorites": 20,
    "can_publish": false,
    "ai_art_limit": 0,
    "ai_text_limit": 0,
    "ai_landing_limit": 0,
    "highlight_results": false,
    "partnerships": false
  }
  ```
- Combos: tratar como um plano separado com `features.line = "combo"` e ambos os conjuntos de features

**2. `PlanCatalogDialog.tsx`** -- Redesenhar com duas abas (Marketplace / ERP / Combos), novos ícones por slug, cards compactos

**3. `useSubscription.ts`** -- Adicionar helper `hasFeature(key)` que lê `subscription.plan.features[key]`

**4. Enforcement** (etapa futura, não neste PR):
- Marketplace: checar `show_contact`, `can_publish`, `details_per_day` nos hooks de consumer
- ERP: checar `max_own_properties`, `max_leads`, `max_users` antes de criar recursos
- IA: checar `ai_art_limit`, `ai_text_limit` contra `ai_usage_logs` do mês corrente

### Arquivos a modificar
1. **SQL** -- UPDATE + INSERT em `subscription_plans` (9 novos registros)
2. **`src/components/settings/PlanCatalogDialog.tsx`** -- UI com abas Marketplace/ERP/Combos
3. **`src/hooks/useSubscription.ts`** -- adicionar `hasFeature()` e `getFeatureLimit()`
4. **`src/hooks/useAutomations.ts`** -- ler `features.automations_limit` do plano real

