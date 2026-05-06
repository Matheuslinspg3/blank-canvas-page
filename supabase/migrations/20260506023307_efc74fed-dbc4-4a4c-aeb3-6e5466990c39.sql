-- Remove the cron job that was previously scheduled for Meta Ads auto-sync
SELECT cron.unschedule('meta-ads-auto-sync');

-- Also clean up any historical jobs that might have different names if applicable
-- But based on the codebase, 'meta-ads-auto-sync' is the standard name.
