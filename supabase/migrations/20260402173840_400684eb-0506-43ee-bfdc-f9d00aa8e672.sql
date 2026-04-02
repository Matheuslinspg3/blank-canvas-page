-- Fix: set search_path on cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_marketplace_intents()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.marketplace_contact_intents WHERE created_at < now() - interval '24 hours';
  RETURN NEW;
END;
$$;