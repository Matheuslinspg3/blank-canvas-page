-- gemini-2.5-flash is text-only, cannot generate images
UPDATE public.ai_router_providers 
SET supports_image_output = false 
WHERE model_id = 'gemini-2.5-flash' AND supports_image_output = true;