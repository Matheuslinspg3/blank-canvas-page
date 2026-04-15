
-- Limpar dados do número 13996666432 para testes de welcome e custos

-- 1. Deletar mensagens do chat
DELETE FROM whatsapp_messages 
WHERE phone LIKE '%13996666432%' OR remote_jid LIKE '%13996666432%';

-- 2. Deletar logs de follow-up associados
DELETE FROM follow_up_log 
WHERE lead_phone LIKE '%13996666432%';

-- 3. Deletar fila de follow-up
DELETE FROM follow_up_queue 
WHERE lead_phone LIKE '%13996666432%';

-- 4. Deletar logs de welcome (para que o welcome dispare novamente)
DELETE FROM whatsapp_welcome_log 
WHERE phone LIKE '%13996666432%';
