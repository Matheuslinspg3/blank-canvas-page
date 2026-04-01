-- 1. follow_up_log table
CREATE TABLE public.follow_up_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES follow_up_queue(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_phone TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  message_sent TEXT NOT NULL,
  message_source TEXT NOT NULL DEFAULT 'template_1'
    CHECK (message_source IN ('template_1', 'ai_generated', 'template_3', 'manual')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status TEXT DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed'))
);

CREATE INDEX idx_followup_log_queue ON follow_up_log (queue_id);
CREATE INDEX idx_followup_log_org_phone ON follow_up_log (org_id, lead_phone);
CREATE INDEX idx_followup_log_sent ON follow_up_log (sent_at DESC);

ALTER TABLE follow_up_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org followup logs"
  ON follow_up_log FOR SELECT TO authenticated
  USING (org_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert followup logs for own org"
  ON follow_up_log FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access on followup log"
  ON follow_up_log FOR ALL
  USING (auth.role() = 'service_role');

-- 2. View
CREATE OR REPLACE VIEW public.whatsapp_contacts_followup_view AS
SELECT 
  c.organization_id,
  c.remote_jid,
  c.last_message_at,
  c.last_message_text,
  c.last_sender_type,
  c.last_from_me,
  c.total_messages,
  COALESCE(fq.lead_name, c.remote_jid) as display_name,
  fq.id as followup_id,
  fq.status as followup_status,
  fq.attempt_count,
  fq.next_followup_at,
  fq.last_outbound_at as followup_last_outbound,
  fq.last_inbound_at as followup_last_inbound,
  fq.opted_out,
  fq.property_interest,
  fq.conversation_context
FROM (
  SELECT 
    organization_id,
    remote_jid,
    MAX(timestamp) as last_message_at,
    (ARRAY_AGG(message_text ORDER BY timestamp DESC))[1] as last_message_text,
    (ARRAY_AGG(sender_type ORDER BY timestamp DESC))[1] as last_sender_type,
    (ARRAY_AGG(from_me ORDER BY timestamp DESC))[1] as last_from_me,
    COUNT(*) as total_messages
  FROM whatsapp_messages
  WHERE remote_jid NOT LIKE '%@g.us'
  GROUP BY organization_id, remote_jid
) c
LEFT JOIN follow_up_queue fq 
  ON fq.org_id = c.organization_id 
  AND fq.lead_phone = c.remote_jid;