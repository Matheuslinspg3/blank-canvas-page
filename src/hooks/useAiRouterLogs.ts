import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiRouterLogFilters {
  organization_id?: string;
  task_type?: string;
  provider_used?: string;
  period?: "today" | "7d" | "30d" | "custom";
  date_from?: string;
  date_to?: string;
  errors_only?: boolean;
  page?: number;
}

export interface AiRouterLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  task_type: string;
  prompt_preview: string | null;
  providers_attempted: string[] | null;
  provider_used: string | null;
  model_used: string | null;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number;
  is_free: boolean;
  estimated_cost_usd: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
  org_name?: string;
}

const PAGE_SIZE = 20;

function getPeriodDate(period?: string): string | null {
  if (!period || period === "custom") return null;
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (period === "7d") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (period === "30d") {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return null;
}

export function useAiRouterLogs(filters: AiRouterLogFilters) {
  const page = filters.page || 0;

  return useQuery({
    queryKey: ["ai-router-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("ai_router_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.organization_id) query = query.eq("organization_id", filters.organization_id);
      if (filters.task_type) query = query.eq("task_type", filters.task_type);
      if (filters.provider_used) query = query.eq("provider_used", filters.provider_used);
      if (filters.errors_only) query = query.eq("success", false);

      const periodDate = getPeriodDate(filters.period);
      if (periodDate) query = query.gte("created_at", periodDate);
      if (filters.period === "custom" && filters.date_from) query = query.gte("created_at", filters.date_from);
      if (filters.period === "custom" && filters.date_to) query = query.lte("created_at", filters.date_to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Fetch org names for logs that have organization_id
      const orgIds = [...new Set((data || []).map((l: any) => l.organization_id).filter(Boolean))];
      let orgMap: Record<string, string> = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);
        orgMap = Object.fromEntries((orgs || []).map((o: any) => [o.id, o.name]));
      }

      const logs: AiRouterLog[] = (data || []).map((l: any) => ({
        ...l,
        org_name: l.organization_id ? orgMap[l.organization_id] || "—" : "—",
      }));

      return { logs, totalCount: count || 0, pageSize: PAGE_SIZE };
    },
    staleTime: 60 * 1000,
  });
}
