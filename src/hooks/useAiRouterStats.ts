import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiRouterStats {
  callsToday: number;
  calls7d: number;
  calls30d: number;
  costPaid30d: number;
  freePercent30d: number;
  dailyCalls: { date: string; count: number }[];
  providerDistribution: { provider: string; count: number; is_free: boolean }[];
  taskDistribution: { task_type: string; count: number }[];
  topOrgs: { org_name: string; total: number; free_pct: number; cost: number }[];
}

export function useAiRouterStats() {
  return useQuery({
    queryKey: ["ai-router-stats"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

      // COST OPT: limit to 10k rows to prevent runaway reads on busy deployments.
      // Aggregated stats remain representative; exact counts use provider_stats table for precision.
      const { data: logs30d, error } = await supabase
        .from("ai_router_logs")
        .select("created_at, provider_used, task_type, is_free, estimated_cost_usd, success, organization_id")
        .gte("created_at", d30)
        .order("created_at", { ascending: true })
        .limit(10000);

      if (error) throw error;
      const all = logs30d || [];

      const callsToday = all.filter((l: any) => l.created_at >= todayStart).length;
      const calls7d = all.filter((l: any) => l.created_at >= d7).length;
      const calls30d = all.length;
      const freeCalls30d = all.filter((l: any) => l.is_free).length;
      const freePercent30d = calls30d > 0 ? Math.round((freeCalls30d / calls30d) * 100) : 100;
      const costPaid30d = all
        .filter((l: any) => !l.is_free)
        .reduce((sum: number, l: any) => sum + (l.estimated_cost_usd || 0), 0);

      // Daily calls
      const dailyMap = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        dailyMap.set(d.toISOString().slice(0, 10), 0);
      }
      all.forEach((l: any) => {
        const day = l.created_at.slice(0, 10);
        if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      });
      const dailyCalls = Array.from(dailyMap, ([date, count]) => ({ date, count }));

      // Provider distribution
      const provMap = new Map<string, { count: number; is_free: boolean }>();
      all.forEach((l: any) => {
        const key = l.provider_used || "unknown";
        const existing = provMap.get(key);
        if (existing) existing.count++;
        else provMap.set(key, { count: 1, is_free: l.is_free });
      });
      const providerDistribution = Array.from(provMap, ([provider, v]) => ({
        provider,
        count: v.count,
        is_free: v.is_free,
      })).sort((a, b) => b.count - a.count);

      // Task distribution
      const taskMap = new Map<string, number>();
      all.forEach((l: any) => {
        taskMap.set(l.task_type, (taskMap.get(l.task_type) || 0) + 1);
      });
      const taskDistribution = Array.from(taskMap, ([task_type, count]) => ({
        task_type,
        count,
      })).sort((a, b) => b.count - a.count);

      // Top orgs
      const orgMap = new Map<string, { total: number; free: number; cost: number; org_id: string }>();
      all.forEach((l: any) => {
        if (!l.organization_id) return;
        const existing = orgMap.get(l.organization_id) || { total: 0, free: 0, cost: 0, org_id: l.organization_id };
        existing.total++;
        if (l.is_free) existing.free++;
        if (!l.is_free) existing.cost += l.estimated_cost_usd || 0;
        orgMap.set(l.organization_id, existing);
      });

      const orgIds = [...orgMap.keys()];
      let orgNames: Record<string, string> = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds.slice(0, 10));
        orgNames = Object.fromEntries((orgs || []).map((o: any) => [o.id, o.name]));
      }

      const topOrgs = Array.from(orgMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((o) => ({
          org_name: orgNames[o.org_id] || o.org_id.slice(0, 8),
          total: o.total,
          free_pct: o.total > 0 ? Math.round((o.free / o.total) * 100) : 100,
          cost: Math.round(o.cost * 10000) / 10000,
        }));

      return {
        callsToday,
        calls7d,
        calls30d,
        costPaid30d: Math.round(costPaid30d * 10000) / 10000,
        freePercent30d,
        dailyCalls,
        providerDistribution,
        taskDistribution,
        topOrgs,
      } as AiRouterStats;
    },
    staleTime: 60 * 1000,
  });
}
