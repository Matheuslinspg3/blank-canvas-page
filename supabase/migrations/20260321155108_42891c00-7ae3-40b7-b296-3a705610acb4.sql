-- Optimize RLS policies: replace slow subqueries with get_user_organization_id()

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
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND created_by = auth.uid());

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
  FOR SELECT USING (run_id IN (SELECT id FROM import_runs WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Users can insert import run items for their organization" ON import_run_items;
CREATE POLICY "Users can insert import run items for their organization" ON import_run_items
  FOR INSERT WITH CHECK (run_id IN (SELECT id FROM import_runs WHERE organization_id = get_user_organization_id()));

DROP POLICY IF EXISTS "Users can update their organization's import run items" ON import_run_items;
CREATE POLICY "Users can update their organization's import run items" ON import_run_items
  FOR UPDATE USING (run_id IN (SELECT id FROM import_runs WHERE organization_id = get_user_organization_id()));