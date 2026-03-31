-- Add unique constraint on message_id for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_message_id_unique 
ON public.whatsapp_messages (message_id) 
WHERE message_id IS NOT NULL;