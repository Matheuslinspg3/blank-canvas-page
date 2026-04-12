import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, subMonths, subDays, endOfMonth, startOfWeek, eachWeekOfInterval, format } from "date-fns";

export type MetricsPeriodKey = "current_month" | "last_month" | "3months" | "6months" | "1year" | "custom";

export interface MetricsDateRange {
  from: Date;
  to: Date;
}

export function computeMetricsRange(key: MetricsPeriodKey, custom?: MetricsDateRange): MetricsDateRange {
  const now = new Date();
  switch (key) {
    case "current_month":
      return { from: startOfMonth(now), to: now };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "3months":
      return { from: subMonths(now, 3), to: now };
    case "6months":
      return { from: subMonths(now, 6), to: now };
    case "1year":
      return { from: subMonths(now, 12), to: now };
    case "custom":
      return custom || { from: startOfMonth(now), to: now };
  }
}

// ─── LEADS ───
export function useLeadsMetrics(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-leads", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, source, stage, temperature, estimated_value, created_at, broker_id")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (error) throw error;
      if (!leads) return null;

      const total = leads.length;
      const bySource: Record<string, number> = {};
      const byStage: Record<string, number> = {};
      const byTemperature: Record<string, number> = {};

      let wonCount = 0;
      let lostCount = 0;
      let lostValue = 0;

      leads.forEach((l) => {
        bySource[l.source || "Desconhecido"] = (bySource[l.source || "Desconhecido"] || 0) + 1;
        byStage[l.stage || "novo"] = (byStage[l.stage || "novo"] || 0) + 1;
        byTemperature[l.temperature || "frio"] = (byTemperature[l.temperature || "frio"] || 0) + 1;

        if (l.stage === "fechado_ganho") wonCount++;
        if (l.stage === "fechado_perdido") {
          lostCount++;
          lostValue += Number(l.estimated_value || 0);
        }
      });

      const closedTotal = wonCount + lostCount;
      const conversionRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0;
      const lossRate = total > 0 ? (lostCount / total) * 100 : 0;

      // Weekly evolution
      const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
      const weeklyData = weeks.map((weekStart) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const count = leads.filter((l) => {
          const d = new Date(l.created_at);
          return d >= weekStart && d <= weekEnd;
        }).length;
        return { week: format(weekStart, "dd/MM"), count };
      });

      return {
        total,
        bySource: Object.entries(bySource).map(([name, value]) => ({ name, value })),
        byStage: Object.entries(byStage).map(([name, value]) => ({ name, value })),
        byTemperature: Object.entries(byTemperature).map(([name, value]) => ({ name, value })),
        conversionRate,
        lossRate,
        wonCount,
        lostCount,
        lostValue,
        weeklyData,
      };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

// ─── LEAD RESPONSE TIME ───
export function useLeadResponseTime(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-response-time", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: leads } = await supabase
        .from("leads")
        .select("id, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .limit(500);

      if (!leads || leads.length === 0) return { avgHours: null };

      const leadIds = leads.map((l) => l.id);
      const { data: interactions } = await supabase
        .from("lead_interactions")
        .select("lead_id, occurred_at")
        .in("lead_id", leadIds.slice(0, 100))
        .order("occurred_at", { ascending: true });

      if (!interactions || interactions.length === 0) return { avgHours: null };

      const firstInteraction: Record<string, string> = {};
      interactions.forEach((i) => {
        if (!firstInteraction[i.lead_id]) firstInteraction[i.lead_id] = i.occurred_at;
      });

      const leadMap = new Map(leads.map((l) => [l.id, l.created_at]));
      let totalHours = 0;
      let count = 0;

      Object.entries(firstInteraction).forEach(([leadId, interactionAt]) => {
        const createdAt = leadMap.get(leadId);
        if (createdAt) {
          const diff = (new Date(interactionAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
          if (diff >= 0 && diff < 720) {
            totalHours += diff;
            count++;
          }
        }
      });

      return { avgHours: count > 0 ? totalHours / count : null };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

// ─── SALES / CONTRACTS ───
export function useSalesMetrics(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-sales", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, type, value, status, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const sales = (contracts || []).filter((c) => c.type === "venda");
      const rentals = (contracts || []).filter((c) => c.type === "locacao");

      const totalSalesValue = sales.reduce((s, c) => s + Number(c.value || 0), 0);
      const totalRentalsValue = rentals.reduce((s, c) => s + Number(c.value || 0), 0);
      const avgTicket = sales.length > 0 ? totalSalesValue / sales.length : 0;

      return {
        salesCount: sales.length,
        totalSalesValue,
        avgTicket,
        rentalsCount: rentals.length,
        totalRentalsValue,
      };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

// ─── FUNNEL ───
export function useFunnelMetrics(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-funnel", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return [];

      const { data: stages } = await supabase
        .from("lead_stages")
        .select("id, name, color, position, is_win, is_loss")
        .or(`organization_id.eq.${orgId},is_default.eq.true`)
        .order("position");

      if (!stages) return [];

      const { data: leads } = await supabase
        .from("leads")
        .select("id, stage")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const stageCounts: Record<string, number> = {};
      (leads || []).forEach((l) => {
        stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
      });

      return stages.map((s) => ({
        name: s.name,
        color: s.color,
        count: stageCounts[s.name] || 0,
        position: s.position,
      }));
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

// ─── PROPERTIES ───
export function usePropertyMetrics(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-properties", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: allProps } = await supabase
        .from("properties")
        .select("id, status, property_type_id, created_at")
        .eq("organization_id", orgId);

      const activeTotal = (allProps || []).filter((p) => p.status !== "inativo").length;
      const addedInPeriod = (allProps || []).filter(
        (p) => new Date(p.created_at) >= dateRange.from && new Date(p.created_at) <= dateRange.to
      ).length;

      // By status
      const byStatus: Record<string, number> = {};
      (allProps || []).forEach((p) => {
        byStatus[p.status || "disponivel"] = (byStatus[p.status || "disponivel"] || 0) + 1;
      });

      // By type
      const { data: types } = await supabase
        .from("property_types")
        .select("id, name")
        .eq("organization_id", orgId);

      const typeMap = new Map((types || []).map((t) => [t.id, t.name]));
      const byType: Record<string, number> = {};
      (allProps || []).forEach((p) => {
        const typeName = typeMap.get(p.property_type_id) || "Outro";
        byType[typeName] = (byType[typeName] || 0) + 1;
      });

      return {
        activeTotal,
        totalRegistered: (allProps || []).length,
        addedInPeriod,
        byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
        byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
      };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

// ─── COMMISSIONS ───
export function useCommissionsMetrics(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-commissions", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: commissions } = await supabase
        .from("commissions")
        .select("amount, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const totalCommission = (commissions || []).reduce((s, c) => s + Number(c.amount || 0), 0);

      // Projection: avg of last 3 months
      const threeMonthsAgo = subMonths(new Date(), 3);
      const { data: recentCommissions } = await supabase
        .from("commissions")
        .select("amount")
        .eq("organization_id", orgId)
        .gte("created_at", threeMonthsAgo.toISOString());

      const recentTotal = (recentCommissions || []).reduce((s, c) => s + Number(c.amount || 0), 0);
      const monthlyProjection = recentTotal / 3;

      return { totalCommission, monthlyProjection };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

// ─── BROKER RANKING ───
export function useBrokerMetrics(dateRange: MetricsDateRange) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-brokers", orgId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!orgId) return [];

      const { data: leads } = await supabase
        .from("leads")
        .select("id, broker_id, stage")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (!leads || leads.length === 0) return [];

      const brokerStats: Record<string, { leads: number; won: number; lost: number }> = {};
      leads.forEach((l) => {
        const brokerId = l.broker_id || "unassigned";
        if (!brokerStats[brokerId]) brokerStats[brokerId] = { leads: 0, won: 0, lost: 0 };
        brokerStats[brokerId].leads++;
        if (l.stage === "fechado_ganho") brokerStats[brokerId].won++;
        if (l.stage === "fechado_perdido") brokerStats[brokerId].lost++;
      });

      const brokerIds = Object.keys(brokerStats).filter((id) => id !== "unassigned");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", brokerIds.slice(0, 50));

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      return Object.entries(brokerStats)
        .filter(([id]) => id !== "unassigned")
        .map(([brokerId, stats]) => {
          const prof = profileMap.get(brokerId);
          const closed = stats.won + stats.lost;
          return {
            brokerId,
            name: prof?.full_name || "Corretor",
            avatar: prof?.avatar_url,
            leadsCount: stats.leads,
            wonCount: stats.won,
            conversionRate: closed > 0 ? (stats.won / closed) * 100 : 0,
          };
        })
        .sort((a, b) => b.wonCount - a.wonCount);
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
