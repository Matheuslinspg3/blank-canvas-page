CREATE OR REPLACE FUNCTION public.fn_agent_ranking(p_org_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH brokers AS (
    SELECT p.user_id, p.full_name, p.avatar_url
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.organization_id = p_org_id
      AND ur.role IN ('corretor', 'admin', 'sub_admin', 'leader')
  ),
  cte_active_leads AS (
    SELECT l.broker_id, COUNT(*) as active_leads
    FROM leads l
    WHERE l.organization_id = p_org_id AND l.is_active = true
    GROUP BY l.broker_id
  ),
  cte_visits AS (
    SELECT a.assigned_to as broker_id, COUNT(*) as visits
    FROM appointments a
    WHERE a.organization_id = p_org_id AND a.completed = true
      AND a.start_time >= p_start AND a.start_time < p_end
    GROUP BY a.assigned_to
  ),
  cte_closings AS (
    SELECT c.broker_id, COUNT(*) as closings
    FROM contracts c
    WHERE c.organization_id = p_org_id
      AND c.created_at >= p_start AND c.created_at < p_end
    GROUP BY c.broker_id
  ),
  cte_interactions AS (
    SELECT li.created_by as broker_id, COUNT(*) as interactions
    FROM lead_interactions li
    JOIN leads l ON l.id = li.lead_id
    WHERE l.organization_id = p_org_id
      AND li.created_at >= p_start AND li.created_at < p_end
    GROUP BY li.created_by
  ),
  cte_first_interactions AS (
    SELECT li.created_by as broker_id,
           AVG(EXTRACT(EPOCH FROM (li.created_at - l.created_at)) / 3600) as avg_response_hours
    FROM lead_interactions li
    JOIN leads l ON l.id = li.lead_id
    WHERE l.organization_id = p_org_id
      AND li.created_at >= p_start AND li.created_at < p_end
      AND li.id = (SELECT id FROM lead_interactions WHERE lead_id = l.id ORDER BY created_at ASC LIMIT 1)
    GROUP BY li.created_by
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.closings DESC, t.active_leads DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      b.user_id,
      b.full_name,
      b.avatar_url,
      COALESCE(al.active_leads, 0) as active_leads,
      COALESCE(v.visits, 0) as visits,
      COALESCE(cl.closings, 0) as closings,
      COALESCE(i.interactions, 0) as interactions,
      fi.avg_response_hours
    FROM brokers b
    LEFT JOIN cte_active_leads al ON al.broker_id = b.user_id
    LEFT JOIN cte_visits v ON v.broker_id = b.user_id
    LEFT JOIN cte_closings cl ON cl.broker_id = b.user_id
    LEFT JOIN cte_interactions i ON i.broker_id = b.user_id
    LEFT JOIN cte_first_interactions fi ON fi.broker_id = b.user_id
  ) t;

  RETURN result;
END;
$function$;