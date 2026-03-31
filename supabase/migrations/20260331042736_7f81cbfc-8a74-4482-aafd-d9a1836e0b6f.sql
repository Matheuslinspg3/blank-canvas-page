ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'customer';

COMMENT ON COLUMN public.whatsapp_messages.sender_type IS 'Type of sender: customer, agent (AI bot), human (dashboard user)';