UPDATE whatsapp_messages wm
SET estimated_cost_usd = sub.total_cost
FROM (
  SELECT message_id, SUM(total_cost_usd) as total_cost
  FROM whatsapp_ai_usage
  WHERE message_id IS NOT NULL AND total_cost_usd > 0
  GROUP BY message_id
) sub
WHERE wm.message_id = sub.message_id
  AND (wm.estimated_cost_usd IS NULL OR wm.estimated_cost_usd = 0);