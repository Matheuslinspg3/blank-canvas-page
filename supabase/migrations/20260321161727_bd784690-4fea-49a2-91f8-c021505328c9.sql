BEGIN;

DROP POLICY "Users can view their org imobzi settings" ON imobzi_settings;
DROP POLICY "Users can insert their org imobzi settings" ON imobzi_settings;
DROP POLICY "Users can update their org imobzi settings" ON imobzi_settings;
DROP POLICY "Users can delete their org imobzi settings" ON imobzi_settings;

COMMIT;