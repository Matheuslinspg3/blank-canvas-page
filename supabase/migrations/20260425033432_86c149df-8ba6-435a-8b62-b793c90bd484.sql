CREATE POLICY "No direct access to broker send locks"
ON public.whatsapp_broker_send_locks
FOR ALL
USING (false)
WITH CHECK (false);