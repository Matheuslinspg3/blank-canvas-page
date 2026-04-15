
DELETE FROM follow_up_log WHERE lead_phone LIKE '%13996666432%';
DELETE FROM follow_up_queue WHERE lead_phone LIKE '%13996666432%';
DELETE FROM whatsapp_welcome_log WHERE phone LIKE '%13996666432%';
DELETE FROM whatsapp_messages WHERE phone LIKE '%13996666432%' OR remote_jid LIKE '%13996666432%';
