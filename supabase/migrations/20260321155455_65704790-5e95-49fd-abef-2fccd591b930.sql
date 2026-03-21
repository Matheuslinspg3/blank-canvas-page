-- RLS optimization part 3 + indexes (fixed visit_date -> scheduled_at)

-- 16. property_status_history
DROP POLICY IF EXISTS "Org members can view status history" ON property_status_history;
CREATE POLICY "Org members can view status history" ON property_status_history
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Org members can insert status history" ON property_status_history;
CREATE POLICY "Org members can insert status history" ON property_status_history
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- 17. property_visits
DROP POLICY IF EXISTS "Users can view visits in their org" ON property_visits;
CREATE POLICY "Users can view visits in their org" ON property_visits
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert visits in their org" ON property_visits;
CREATE POLICY "Users can insert visits in their org" ON property_visits
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update visits in their org" ON property_visits;
CREATE POLICY "Users can update visits in their org" ON property_visits
  FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete visits in their org" ON property_visits;
CREATE POLICY "Users can delete visits in their org" ON property_visits
  FOR DELETE USING (organization_id = get_user_organization_id());

-- 18. whatsapp_instances
DROP POLICY IF EXISTS "Managers can view own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can view own org instance" ON whatsapp_instances
  FOR SELECT USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Managers can insert own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can insert own org instance" ON whatsapp_instances
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Managers can update own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can update own org instance" ON whatsapp_instances
  FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Managers can delete own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can delete own org instance" ON whatsapp_instances
  FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

-- 19. ticket_messages
DROP POLICY IF EXISTS "Users can insert own org ticket messages" ON ticket_messages;
CREATE POLICY "Users can insert own org ticket messages" ON ticket_messages
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM support_tickets st WHERE st.id = ticket_messages.ticket_id AND st.organization_id = get_user_organization_id()));

-- 20. user_roles
DROP POLICY IF EXISTS "Users view roles in same org" ON user_roles;
CREATE POLICY "Users view roles in same org" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = user_roles.user_id AND p.organization_id = get_user_organization_id())
  );

DROP POLICY IF EXISTS "Org admins can delete roles" ON user_roles;
CREATE POLICY "Org admins can delete roles" ON user_roles
  FOR DELETE USING (
    has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = user_roles.user_id AND p.organization_id = get_user_organization_id()))
  );

-- INDEXES (fixed: visit_date -> scheduled_at)
CREATE INDEX IF NOT EXISTS idx_commissions_contract ON commissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_commissions_broker ON commissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_commissions_org ON commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_lead_stages_org ON lead_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_types_org ON lead_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_property_types_org ON property_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_org_date ON property_visits(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract ON contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);