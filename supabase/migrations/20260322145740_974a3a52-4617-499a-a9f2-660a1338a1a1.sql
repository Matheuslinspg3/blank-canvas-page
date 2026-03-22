
-- Fix: exclude image-only providers from text tasks
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
    SELECT COALESCE(jsonb_agg(provider_key ORDER BY is_free DESC, priority ASC, display_name ASC), '[]'::jsonb)
    INTO chain
    FROM ai_router_providers
    WHERE is_active = true
      AND (
        CASE
          -- Image generation tasks: only providers with image output
          WHEN task.complexity = 'image' THEN supports_image_output = true
          -- Tasks requiring image input (analyze_photo, pdf_extract): need image input capability
          WHEN task.requires_image = true THEN supports_image_input = true
          -- Text tasks: exclude image-only providers (those with image output but no text capability)
          ELSE NOT (supports_image_output = true AND supports_image_input = false 
                    AND model_id IN ('dall-e-3', 'dall-e-2', 'gpt-image-1', 'gpt-image-1-mini'))
        END
      );

    UPDATE ai_router_config
    SET provider_chain = chain,
        updated_at = now()
    WHERE task_type = task.task_type;
  END LOOP;
END;
$$;

-- Re-run to fix current data
SELECT rebuild_provider_chains();
