DELETE FROM public.follow_up_queue 
WHERE broker_channel_id IS NOT NULL 
AND status = 'pending' 
AND attempt_count = 0;