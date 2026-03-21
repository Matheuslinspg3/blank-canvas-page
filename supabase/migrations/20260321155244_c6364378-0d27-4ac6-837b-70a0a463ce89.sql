-- RLS optimization part 2

-- 9. lead_document_templates
DROP POLICY IF EXISTS "Org members can view templates" ON lead_document_templates;
CREATE POLICY "Org members can view templates" ON lead_document_templates
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage templates" ON lead_document_templates;
CREATE POLICY "Admins can manage templates" ON lead_document_templates
  FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

-- 10. lead_document_template_items
DROP POLICY IF EXISTS "Org members can view template items" ON lead_document_template_items;
CREATE POLICY "Org members can view template items" ON lead_document_template_items
  FOR SELECT USING (template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Admins can manage template items" ON lead_document_template_items;
CREATE POLICY "Admins can manage template items" ON lead_document_template_items
  FOR ALL
  USING (template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = get_user_organization_id()))
  WITH CHECK (template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = get_user_organization_id()) AND is_org_manager_or_above(auth.uid()));

-- 11. lead_documents
DROP POLICY IF EXISTS "Org members can view lead documents" ON lead_documents;
CREATE POLICY "Org members can view lead documents" ON lead_documents
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Org members can insert lead documents" ON lead_documents;
CREATE POLICY "Org members can insert lead documents" ON lead_documents
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Org members can update lead documents" ON lead_documents;
CREATE POLICY "Org members can update lead documents" ON lead_documents
  FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can delete lead documents" ON lead_documents;
CREATE POLICY "Admins can delete lead documents" ON lead_documents
  FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

-- 12. lead_score_events
DROP POLICY IF EXISTS "Users can view own org score events" ON lead_score_events;
CREATE POLICY "Users can view own org score events" ON lead_score_events
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert own org score events" ON lead_score_events;
CREATE POLICY "Users can insert own org score events" ON lead_score_events
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- 13. lead_stages
DROP POLICY IF EXISTS "Users can view stages for their org" ON lead_stages;
CREATE POLICY "Users can view stages for their org" ON lead_stages
  FOR SELECT USING (organization_id IS NULL OR organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert stages for their org" ON lead_stages;
CREATE POLICY "Users can insert stages for their org" ON lead_stages
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update stages for their org" ON lead_stages;
CREATE POLICY "Users can update stages for their org" ON lead_stages
  FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete stages for their org" ON lead_stages;
CREATE POLICY "Users can delete stages for their org" ON lead_stages
  FOR DELETE USING (organization_id = get_user_organization_id());

-- 14. organization_custom_roles
DROP POLICY IF EXISTS "Org members can view custom roles" ON organization_custom_roles;
CREATE POLICY "Org members can view custom roles" ON organization_custom_roles
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Org admins can manage custom roles" ON organization_custom_roles;
CREATE POLICY "Org admins can manage custom roles" ON organization_custom_roles
  FOR ALL
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()));

-- 15. organization_member_events
DROP POLICY IF EXISTS "Org admins can view member events" ON organization_member_events;
CREATE POLICY "Org admins can view member events" ON organization_member_events
  FOR SELECT USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "System can insert member events" ON organization_member_events;
CREATE POLICY "System can insert member events" ON organization_member_events
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));