-- Add ai_blacklist boolean to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_blacklist boolean NOT NULL DEFAULT false;

-- Remove all whitelist entries from whatsapp_property_rules
DELETE FROM public.whatsapp_property_rules WHERE rule_type = 'whitelist';