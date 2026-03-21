-- Optimize 52 RLS policies across 20 tables: replace slow profiles subqueries with get_user_organization_id()

-- 1. activity_log
DROP POLICY IF EXISTS "Members can view org activities" ON activity_log;
CREATE POLICY "Members can view org activities" ON activity_log
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Members can insert org activities" ON activity_log;
CREATE POLICY "Members can insert org activities" ON activity_log
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- 2. anuncios_gerados
DROP POLICY IF EXISTS "Users can view own org anuncios" ON anuncios_gerados;
CREATE POLICY "Users can view own org anuncios" ON anuncios_gerados
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert own org anuncios" ON anuncios_gerados;
CREATE POLICY "Users can insert own org anuncios" ON anuncios_gerados
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- 3. brand_settings
DROP POLICY IF EXISTS "Users can view own org brand settings" ON brand_settings;
CREATE POLICY "Users can view own org brand settings" ON brand_settings
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update own org brand settings" ON brand_settings;
CREATE POLICY "Users can update own org brand settings" ON brand_settings
  FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can upsert own org brand settings" ON brand_settings;
CREATE POLICY "Users can upsert own org brand settings" ON brand_settings
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- 4. contract_templates
DROP POLICY IF EXISTS "Users can view templates of their org" ON contract_templates;
CREATE POLICY "Users can view templates of their org" ON contract_templates
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert templates in their org" ON contract_templates;
CREATE POLICY "Users can insert templates in their org" ON contract_templates
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update templates in their org" ON contract_templates;
CREATE POLICY "Users can update templates in their org" ON contract_templates
  FOR UPDATE USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete templates in their org" ON contract_templates;
CREATE POLICY "Users can delete templates in their org" ON contract_templates
  FOR DELETE USING (organization_id = get_user_organization_id());

-- 5. generated_arts
DROP POLICY IF EXISTS "Users can view own org arts" ON generated_arts;
CREATE POLICY "Users can view own org arts" ON generated_arts
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert own org arts" ON generated_arts;
CREATE POLICY "Users can insert own org arts" ON generated_arts
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id()
    AND created_by = auth.uid()
  );

-- 6. generated_videos
DROP POLICY IF EXISTS "Users can view own org videos" ON generated_videos;
CREATE POLICY "Users can view own org videos" ON generated_videos
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert own org videos" ON generated_videos;
CREATE POLICY "Users can insert own org videos" ON generated_videos
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update own org videos" ON generated_videos;
CREATE POLICY "Users can update own org videos" ON generated_videos
  FOR UPDATE USING (organization_id = get_user_organization_id());

-- 7. import_runs
DROP POLICY IF EXISTS "Users can view their organization's import runs" ON import_runs;
CREATE POLICY "Users can view their organization's import runs" ON import_runs
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert import runs for their organization" ON import_runs;
CREATE POLICY "Users can insert import runs for their organization" ON import_runs
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their organization's import runs" ON import_runs;
CREATE POLICY "Users can update their organization's import runs" ON import_runs
  FOR UPDATE USING (organization_id = get_user_organization_id());

-- 8. import_run_items
DROP POLICY IF EXISTS "Users can view their organization's import run items" ON import_run_items;
CREATE POLICY "Users can view their organization's import run items" ON import_run_items
  FOR SELECT USING (
    run_id IN (SELECT id FROM import_runs WHERE organization_id = get_user_organization_id())
  );

DROP POLICY IF EXISTS "Users can insert import run items for their organization" ON import_run_items;
CREATE POLICY "Users can insert import run items for their organization" ON import_run_items
  FOR INSERT WITH CHECK (
    run_id IN (SELECT id FROM import_runs WHERE organization_id = get_user_organization_id())
  );

DROP POLICY IF EXISTS "Users can update their organization's import run items" ON import_run_items;
CREATE POLICY "Users can update their organization's import run items" ON import_run_items
  FOR UPDATE USING (
    run_id IN (SELECT id FROM import_runs WHERE organization_id = get_user_organization_id())
  );

-- 9. lead_document_templates
DROP POLICY IF EXISTS "Org members can view templates" ON lead_document_templates;
CREATE POLICY "Org members can view templates" ON lead_document_templates
  FOR SELECT USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage templates" ON lead_document_templates;
CREATE POLICY "Admins can manage templates" ON lead_document_templates
  FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_org_manager_or_above(auth.uid())
  );

-- 10. lead_document_template_items
DROP POLICY IF EXISTS "Org members can view template items" ON lead_document_template_items;
CREATE POLICY "Org members can view template items" ON lead_document_template_items
  FOR SELECT USING (
    template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = get_user_organization_id())
  );

DROP POLICY IF EXISTS "Admins can manage template items" ON lead_document_template_items;
CREATE POLICY "Admins can manage template items" ON lead_document_template_items
  FOR ALL
  USING (
    template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = get_user_organization_id())
  )
  WITH CHECK (
    template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = get_user_organization_id())
    AND is_org_manager_or_above(auth.uid())
  );

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
  FOR DELETE USING (
    organization_id = get_user_organization_id()
    AND is_org_manager_or_above(auth.uid())
  );

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
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id = get_user_organization_id()
  );

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
  FOR SELECT USING (
    organization_id = get_user_organization_id()
    AND is_org_manager_or_above(auth.uid())
  );

DROP POLICY IF EXISTS "System can insert member events" ON organization_member_events;
CREATE POLICY "System can insert member events" ON organization_member_events
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_org_manager_or_above(auth.uid())
  );

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
  FOR SELECT USING (
    organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid())
  );

DROP POLICY IF EXISTS "Managers can insert own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can insert own org instance" ON whatsapp_instances
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid())
  );

DROP POLICY IF EXISTS "Managers can update own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can update own org instance" ON whatsapp_instances
  FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "Managers can delete own org instance" ON whatsapp_instances;
CREATE POLICY "Managers can delete own org instance" ON whatsapp_instances
  FOR DELETE USING (
    organization_id = get_user_organization_id() AND is_org_manager_or_above(auth.uid())
  );

-- 19. ticket_messages
DROP POLICY IF EXISTS "Users can insert own org ticket messages" ON ticket_messages;
CREATE POLICY "Users can insert own org ticket messages" ON ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
        AND st.organization_id = get_user_organization_id()
    )
  );

-- 20. user_roles
DROP POLICY IF EXISTS "Users view roles in same org" ON user_roles;
CREATE POLICY "Users view roles in same org" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "Org admins can delete roles" ON user_roles;
CREATE POLICY "Org admins can delete roles" ON user_roles
  FOR DELETE USING (
    has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = user_roles.user_id
          AND p.organization_id = get_user_organization_id()
      )
    )
  );