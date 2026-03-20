

## Redesign da Seção de Marketing - Padronização Meta Ads e RD Station

### Problema
As abas de Meta Ads e RD Station têm estruturas completamente diferentes: conexão OAuth fica em abas diferentes, a organização das sub-abas não segue um padrão, e a experiência é confusa.

### Novo Layout Padronizado

Ambas as plataformas seguirão a **mesma estrutura de abas**:

```text
Marketing
├── Meta Ads
│   ├── Conexão        ← OAuth + status + automação CRM
│   ├── Leads          ← inbox de leads recebidos
│   ├── Estatísticas   ← métricas e desempenho
│   └── Anúncios       ← lista de ads sincronizados
│
├── RD Station
│   ├── Conexão        ← OAuth + webhook + chaves API + automação CRM
│   ├── Leads          ← leads recebidos via webhook/OAuth (stats atual)
│   ├── Estatísticas   ← métricas e conversões
│   └── Webhook Logs   ← histórico de webhooks
│
├── Gerador IA
├── Artes
├── Vídeo
└── Marca
```

### Mudanças por Arquivo

**1. `src/pages/Anuncios.tsx`** — Reorganizar sub-abas
- Meta Ads: renomear abas para `conexao`, `leads`, `estatisticas`, `anuncios` (nesta ordem)
- RD Station: renomear abas para `conexao`, `leads`, `estatisticas`, `webhook_logs`
- A primeira aba de ambos será "Conexão" (padronizado)

**2. Criar `src/components/ads/MetaConnectionTab.tsx`** — Nova aba unificada de conexão Meta
- Mover o conteúdo de `MetaSettingsContent.tsx` para cá
- Inclui: OAuth connect/disconnect, status, automação CRM, botões de sync
- Renomear visualmente para "Conexão"

**3. Criar `src/components/ads/rdstation/RDConnectionTab.tsx`** — Nova aba unificada de conexão RD
- Combinar conteúdo de `RDSettingsTab` + `RDOAuthTab` numa única aba
- Ordem: Status/ativar → OAuth connect → Chaves API → Automação CRM → Salvar
- Tudo numa aba só, eliminando a fragmentação

**4. Criar `src/components/ads/rdstation/RDLeadsTab.tsx`** — Nova aba de leads RD
- Extrair a seção de leads/contatos do `RDStationStatsContent` e `RDOAuthTab` (botão "Abrir Lista de Contatos")
- Criar uma inbox similar ao `MetaLeadsInboxContent` para leads vindos do RD Station

**5. Atualizar `src/components/ads/rdstation/RDWebhookTab.tsx`** — Renomear para "Webhook Logs"
- Manter apenas os logs de webhook (remover URL setup que vai para a aba Conexão)
- Ou manter a URL de webhook aqui por ser operacional

**6. Padrão visual de "Connection Card"**
- Criar um componente reutilizável `IntegrationConnectionCard` usado por ambos Meta e RD
- Props: `platform`, `isConnected`, `onConnect`, `onDisconnect`, `statusBadge`, `accountInfo`
- Garante visual idêntico entre plataformas

### Resumo das Ações
1. Criar componente `IntegrationConnectionCard` reutilizável
2. Criar `MetaConnectionTab` consolidando conexão + automação + sync
3. Criar `RDConnectionTab` consolidando OAuth + API keys + automação + status
4. Criar `RDLeadsTab` com inbox de leads do RD Station
5. Atualizar `Anuncios.tsx` com nova estrutura de abas padronizada (Conexão → Leads → Estatísticas → ...)
6. Limpar componentes antigos que foram consolidados

