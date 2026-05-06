import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, subMonths, subDays, endOfMonth, eachWeekOfInterval, format } from "date-fns";

export type MetricsPeriodKey = "today" | "last_7_days" | "current_month" | "last_month" | "custom";

export interface MetricsDateRange {
  from: Date;
  to: Date;
}

export interface MetricsFilters {
  brokerId?: string; // "all", "none", or specific user_id
  leadStatus?: "all" | "active" | "inactive";
  deduplicate?: boolean;
}


export function computeMetricsRange(key: MetricsPeriodKey, custom?: MetricsDateRange): MetricsDateRange {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (key) {
    case "today":
      return { from: startOfToday, to: endOfToday };
    case "last_7_days":
      return { from: subDays(startOfToday, 7), to: endOfToday };
    case "current_month":
      return { from: startOfMonth(now), to: endOfToday };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "custom":
      if (custom) {
        const from = new Date(custom.from.getFullYear(), custom.from.getMonth(), custom.from.getDate(), 0, 0, 0, 0);
        const to = new Date(custom.to.getFullYear(), custom.to.getMonth(), custom.to.getDate(), 23, 59, 59, 999);
        return { from, to };
      }
      return { from: startOfMonth(now), to: endOfToday };
    default:
      return { from: startOfMonth(now), to: endOfToday };
  }
}


// ─── LEADS ───
export function useLeadsMetrics(dateRange: MetricsDateRange, filters?: MetricsFilters) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-leads", orgId, dateRange.from.toISOString(), dateRange.to.toISOString(), filters],
    queryFn: async () => {
      if (!orgId) return null;

      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select(`
          id, 
          source, 
          is_active, 
          phone, 
          estimated_value, 
          created_at, 
          broker_id, 
          lead_stage_id,
          lead_stages(name, is_win, is_loss)
        `)
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (leadsError) throw leadsError;
      if (!leadsData) return null;

      let filteredLeads = leadsData;
      if (filters?.brokerId) {
        if (filters.brokerId === "none") {
          filteredLeads = filteredLeads.filter(l => !l.broker_id);
        } else if (filters.brokerId !== "all") {
          filteredLeads = filteredLeads.filter(l => l.broker_id === filters.brokerId);
        }
      }

      if (filters?.leadStatus === "active") {
        filteredLeads = filteredLeads.filter(l => l.is_active);
      } else if (filters?.leadStatus === "inactive") {
        filteredLeads = filteredLeads.filter(l => !l.is_active);
      }

      const normalizePhone = (p: string) => p?.replace(/\D/g, "") || "";
      
      let processedLeads = filteredLeads;
      if (filters?.deduplicate) {
        const seen = new Set<string>();
        processedLeads = filteredLeads.filter(l => {
          const p = normalizePhone(l.phone || "");
          if (!p) return true;
          if (seen.has(p)) return false;
          seen.add(p);
          return true;
        });
      }

      const phones = leadsData.map(l => normalizePhone(l.phone || "")).filter(Boolean);
      const duplicateCount = leadsData.length - new Set(phones).size;

      const total = processedLeads.length;
      const activeCount = processedLeads.filter(l => l.is_active).length;
      const inactiveCount = total - activeCount;
      const withBroker = processedLeads.filter(l => !!l.broker_id).length;
      const withoutBroker = total - withBroker;

      const bySource: Record<string, number> = {};
      const byStage: Record<string, number> = {};
      
      let wonCount = 0;
      let lostCount = 0;
      let lostValue = 0;

      processedLeads.forEach((l) => {
        const sourceName = l.source || "Desconhecido";
        const stage = l.lead_stages as any;
        const stageName = stage?.name || "Sem etapa";
        
        bySource[sourceName] = (bySource[sourceName] || 0) + 1;
        byStage[stageName] = (byStage[stageName] || 0) + 1;

        if (stage?.is_win) wonCount++;
        if (stage?.is_loss) {
          lostCount++;
          lostValue += Number(l.estimated_value || 0);
        }
      });

      const closedTotal = wonCount + lostCount;
      const conversionRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0;
      const lossRate = closedTotal > 0 ? (lostCount / closedTotal) * 100 : 0;

      // Weekly evolution
      const weeks = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to }, { weekStartsOn: 1 });
      const weeklyData = weeks.map((weekStart) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const count = processedLeads.filter((l) => {
          const d = new Date(l.created_at);
          return d >= weekStart && d <= weekEnd;
        }).length;
        return { week: format(weekStart, "dd/MM"), count };
      });

      return {
        total,
        activeCount,
        inactiveCount,
        duplicateCount,
        withBroker,
        withoutBroker,
        wonCount,
        lostCount,
        lostValue,
        conversionRate,
        lossRate,
        bySource: Object.entries(bySource).map(([name, value]) => ({ name, value })),
        byStage: Object.entries(byStage).map(([name, value]) => ({ name, value })),
        weeklyData,
        rawData: processedLeads
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
        .eq("organization_id", orgId)
        .order("position");

      if (!stages || stages.length === 0) {
          const { data: defaultStages } = await supabase
            .from("lead_stages")
            .select("id, name, color, position, is_win, is_loss")
            .eq("is_default", true)
            .order("position");
          if (!defaultStages) return [];
          return defaultStages.map(s => ({ ...s, count: 0 }));
      }

      const { data: leads } = await supabase
        .from("leads")
        .select("id, lead_stage_id")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const stageCounts: Record<string, number> = {};
      (leads || []).forEach((l) => {
        if (l.lead_stage_id) {
            stageCounts[l.lead_stage_id] = (stageCounts[l.lead_stage_id] || 0) + 1;
        }
      });

      return stages.map((s) => ({
        name: s.name,
        color: s.color,
        count: stageCounts[s.id] || 0,
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

      const { data: allProps, error } = await supabase
        .from("properties")
        .select("id, status, property_type_id, launch_stage, created_at, created_by")
        .eq("organization_id", orgId);

      if (error) throw error;

      const addedInPeriod = (allProps || []).filter(
        (p) => new Date(p.created_at) >= dateRange.from && new Date(p.created_at) <= dateRange.to
      );

      const activeTotal = (allProps || []).filter((p) => p.status !== "inativo").length;
      const inactiveTotal = (allProps || []).filter((p) => p.status === "inativo").length;
      const futureTotal = (allProps || []).filter((p) => p.launch_stage === "futuro").length;

      // By status
      const byStatus: Record<string, number> = {};
      (allProps || []).forEach((p) => {
        const s = p.status || "disponivel";
        byStatus[s] = (byStatus[s] || 0) + 1;
      });

      // By launch stage
      const byLaunchStage: Record<string, number> = {};
      (allProps || []).forEach((p) => {
        const ls = p.launch_stage || "nenhum";
        byLaunchStage[ls] = (byLaunchStage[ls] || 0) + 1;
      });

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
        inactiveTotal,
        futureTotal,
        totalRegistered: (allProps || []).length,
        addedInPeriod: addedInPeriod.length,
        byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
        byType: Object.entries(byType).map(([name, value]) => ({ name, value })),
        byLaunchStage: Object.entries(byLaunchStage).map(([name, value]) => ({ name, value })),
        rawData: allProps
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
export function useBrokerRankingMetrics(dateRange: MetricsDateRange, filters?: MetricsFilters) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["metrics-broker-ranking", orgId, dateRange.from.toISOString(), dateRange.to.toISOString(), filters],
    queryFn: async () => {
      if (!orgId) return [];

      let leadsQuery = supabase
        .from("leads")
        .select("id, broker_id, lead_stage_id, is_active, phone, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (filters?.leadStatus === "active") {
        leadsQuery = leadsQuery.eq("is_active", true);
      } else if (filters?.leadStatus === "inactive") {
        leadsQuery = leadsQuery.eq("is_active", false);
      }

      const { data: leads } = await leadsQuery;
      const { data: allProps } = await supabase
        .from("properties")
        .select("id, created_by, status")
        .eq("organization_id", orgId);

      if (!leads) return [];

      const normalizePhone = (p: string) => p?.replace(/\D/g, "") || "";
      let processedLeads = leads;
      if (filters?.deduplicate) {
        const seen = new Set<string>();
        processedLeads = leads.filter(l => {
          const p = normalizePhone(l.phone || "");
          if (!p) return true;
          if (seen.has(p)) return false;
          seen.add(p);
          return true;
        });
      }

      const { data: stages } = await supabase
        .from("lead_stages")
        .select("id, name")
        .or(`organization_id.eq.${orgId},is_default.eq.true`);

      const stageMap = new Map(stages?.map(s => [s.id, s.name]));

      const brokerStats: Record<string, any> = {};
      
      const initializeBroker = (id: string) => {
        if (!brokerStats[id]) {
          brokerStats[id] = { 
            leads: 0, 
            active: 0, 
            inactive: 0, 
            duplicates: 0,
            byStage: {},
            propertiesCreated: 0,
            propertiesInactive: 0,
            phones: new Set()
          };
        }
      };

      processedLeads.forEach((l) => {
        const brokerId = l.broker_id || "none";
        initializeBroker(brokerId);
        
        brokerStats[brokerId].leads++;
        if (l.is_active) brokerStats[brokerId].active++;
        else brokerStats[brokerId].inactive++;
        
        const stageName = stageMap.get(l.lead_stage_id) || "Sem etapa";
        brokerStats[brokerId].byStage[stageName] = (brokerStats[brokerId].byStage[stageName] || 0) + 1;
        
        const p = normalizePhone(l.phone || "");
        if (p) {
          if (brokerStats[brokerId].phones.has(p)) brokerStats[brokerId].duplicates++;
          brokerStats[brokerId].phones.add(p);
        }
      });

      (allProps || []).forEach(p => {
        if (p.created_by) {
          initializeBroker(p.created_by);
          brokerStats[p.created_by].propertiesCreated++;
          if (p.status === "inativo") brokerStats[p.created_by].propertiesInactive++;
        }
      });

      const brokerIds = Object.keys(brokerStats).filter(id => id !== "none");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", brokerIds.slice(0, 100));

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      return Object.entries(brokerStats).map(([id, stats]) => {
        const prof = profileMap.get(id);
        return {
          brokerId: id,
          name: id === "none" ? "Leads sem corretor" : (prof?.full_name || "Corretor"),
          avatar: prof?.avatar_url,
          ...stats,
          participation: processedLeads.length > 0 ? (stats.leads / processedLeads.length) * 100 : 0
        };
      }).sort((a, b) => b.leads - a.leads);
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
