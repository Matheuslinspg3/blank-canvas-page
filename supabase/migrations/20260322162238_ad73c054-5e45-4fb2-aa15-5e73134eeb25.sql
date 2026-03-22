-- Update OpenAI image provider: set supports_image_input=true (needed for edits)
-- and change model_id to dall-e-2 which is the only model guaranteed to work with /images/edits
UPDATE ai_router_providers 
SET supports_image_input = true,
    model_id = 'dall-e-2'
WHERE provider_key = 'openai_dall_e_3_mn19agwn';