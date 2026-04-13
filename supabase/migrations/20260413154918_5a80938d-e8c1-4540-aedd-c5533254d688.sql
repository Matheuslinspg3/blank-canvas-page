
-- Give addon-automations its own automation allowance
UPDATE subscription_plans 
SET automation_allowance_brl = 15.00 
WHERE slug = 'addon-automations';

-- Add average cost tracking for estimation
ALTER TABLE automation_credit_wallets 
ADD COLUMN IF NOT EXISTS avg_cost_per_message_brl numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_messages_processed integer DEFAULT 0;
