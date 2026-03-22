
-- Function to rebuild provider_chain for all task configs
-- based on actual active providers, ordered by: free first, then priority
CREATE OR REPLACE FUNCTION rebuild_provider_chains()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task RECORD;
  chain jsonb;
BEGIN
  FOR task IN SELECT task_type, complexity, requires_image FROM ai_router_config WHERE is_active = true
  LOOP
    -- Build ordered array of provider_keys matching the task's requirements
    SELECT COALESCE(jsonb_agg(provider_key ORDER BY is_free DESC, priority ASC, display_name ASC), '[]'::jsonb)
    INTO chain
    FROM ai_router_providers
    WHERE is_active = true
      AND (
        CASE
          -- Image generation tasks: only providers with image output
          WHEN task.complexity = 'image' THEN supports_image_output = true
          -- Tasks requiring image input (analyze_photo, pdf_extract)
          WHEN task.requires_image = true THEN supports_image_input = true
          -- Text tasks: any provider (but exclude image-only providers)
          ELSE true
        END
      );

    UPDATE ai_router_config
    SET provider_chain = chain,
        updated_at = now()
    WHERE task_type = task.task_type;
  END LOOP;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION trg_rebuild_provider_chains()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM rebuild_provider_chains();
  RETURN NULL;
END;
$$;

-- Triggers on provider insert, delete, and relevant updates
DROP TRIGGER IF EXISTS trg_providers_rebuild_chains_insert ON ai_router_providers;
DROP TRIGGER IF EXISTS trg_providers_rebuild_chains_delete ON ai_router_providers;
DROP TRIGGER IF EXISTS trg_providers_rebuild_chains_update ON ai_router_providers;

CREATE TRIGGER trg_providers_rebuild_chains_insert
  AFTER INSERT ON ai_router_providers
  FOR EACH STATEMENT EXECUTE FUNCTION trg_rebuild_provider_chains();

CREATE TRIGGER trg_providers_rebuild_chains_delete
  AFTER DELETE ON ai_router_providers
  FOR EACH STATEMENT EXECUTE FUNCTION trg_rebuild_provider_chains();

CREATE TRIGGER trg_providers_rebuild_chains_update
  AFTER UPDATE OF is_active, is_free, priority, supports_image_input, supports_image_output
  ON ai_router_providers
  FOR EACH STATEMENT EXECUTE FUNCTION trg_rebuild_provider_chains();

-- Run it now to sync existing data
SELECT rebuild_provider_chains();
