UPDATE public.meta_lead_failures 
SET status = 'resolved', resolved_at = now() 
WHERE leadgen_id = 'TEST_REPROCESS_SUCCESS';
