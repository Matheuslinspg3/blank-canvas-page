

# Melhorar o Sistema de Créditos do Agente IA

## Problema
O card "Créditos de Automação" expõe detalhes técnicos internos ao usuário (markup 3x, custo médio por mensagem em BRL, etc.). O usuário final não precisa saber sobre markup — ele só quer entender quanto saldo tem, quanto usou, e quantas mensagens ainda pode enviar.

## Alterações

### 1. Refatorar `AutomationCreditWalletCard.tsx`
- Remover menção a "Markup: 3x sobre custo real" da `CardDescription`
- Trocar descrição para algo amigável: "Saldo do seu agente IA para automações e WhatsApp"
- Manter os 4 cards de métricas (Saldo Atual, Total Consumido, Total Recarregado, Incluso no Plano) mas sem expor markup
- Melhorar visual: adicionar cores mais claras nos badges de status (verde = saldo ok, amarelo = baixo, vermelho = sem créditos)
- Adicionar badge de status no header do card (ex: "Ativo", "Saldo Baixo", "Esgotado")

### 2. Refatorar `AutomationCreditEstimationCard.tsx`
- Remover "Custo Médio/Msg" do grid visível (dado técnico interno)
- Manter: Mensagens Restantes, Dias Restantes, Msgs/Dia (7d) — são dados úteis ao usuário
- Substituir o 4º card por "Total Processado" (quantidade de mensagens, não valor)
- Manter alertas de saldo baixo e esgotado como estão (são bons)

### 3. Melhorar UX geral
- Unificar os dois cards em uma experiência mais coesa com seções claras: "Seu Saldo" + "Previsão de Uso"
- Progress bar com cores dinâmicas (verde >50%, amarelo 20-50%, vermelho <20%)
- Texto do rodapé sem mencionar custo médio em BRL

## Arquivos a editar
- `src/components/integrations/whatsapp-agent/AutomationCreditWalletCard.tsx` — remover markup, melhorar labels
- `src/components/integrations/whatsapp-agent/AutomationCreditEstimationCard.tsx` — remover custo médio visível, melhorar UX

