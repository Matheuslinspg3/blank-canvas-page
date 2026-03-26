
-- Add conversion_identifier column to leads for RD Station conversion tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversion_identifier text;

-- Add traffic_source column for origin tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS traffic_source text;

-- Backfill from notes where possible
UPDATE public.leads 
SET conversion_identifier = (
  regexp_match(notes, 'Primeira conversão: (.+)')
)[1]
WHERE external_source = 'rdstation' 
  AND conversion_identifier IS NULL 
  AND notes LIKE '%Primeira conversão:%';

UPDATE public.leads 
SET traffic_source = (
  regexp_match(notes, 'Origem: (.+)')
)[1]
WHERE external_source = 'rdstation' 
  AND traffic_source IS NULL 
  AND notes LIKE '%Origem:%';
