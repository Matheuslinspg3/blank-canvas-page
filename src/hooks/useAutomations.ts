import { useState, useCallback, useMemo, useEffect } from "react";
import type { AutomationRule } from "@/types/automation";
import { useSubscription, getFeatureLimit } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AutomationPlan = "free" | "pro" | "enterprise";

export interface AutomationStats {
  totalActive: number;
  totalPaused: number;
  leadsImpacted: number;
  messagesSent: number;
  tasksCreated: number;
  conversions: number;
  avgResponseRate: number;
  nextExecution: string | null;
}

interface DbAutomation {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_conditions: Record<string, unknown>;
  actions: Array<{ type: string; config: Record<string, unknown>; delay?: number }>;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function dbToRule(db: DbAutomation): AutomationRule {
  return {
    id: db.id,
    name: db.name,
    description: db.description ?? undefined,
    trigger: {
      type: db.trigger_type as AutomationRule["trigger"]["type"],
      conditions: db.trigger_conditions,
    },
    actions: db.actions as AutomationRule["actions"],
    enabled: db.enabled,
    created_at: db.created_at,
    updated_at: db.updated_at,
  };
}

export function useAutomations() {
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AutomationStats>({
    totalActive: 0,
    totalPaused: 0,
    leadsImpacted: 0,
    messagesSent: 0,
    tasksCreated: 0,
    conversions: 0,
    avgResponseRate: 0,
    nextExecution: null,
  });
  const { currentPlan } = useSubscription();
  const { profile } = useAuth();

  const automationsLimit = getFeatureLimit(currentPlan, "automations_limit");

  const plan: AutomationPlan = useMemo(() => {
    if (automationsLimit === null) return "enterprise";
    if (automationsLimit > 0) return "pro";
    return "free";
  }, [automationsLimit]);

  // Fetch automations from database
  const fetchAutomations = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rules = (data as unknown as DbAutomation[]).map(dbToRule);
      setAutomations(rules);
    } catch (err) {
      console.error("Error fetching automations:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id]);

  // Fetch stats from execution logs
  const fetchStats = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: executions } = await supabase
        .from("automation_executions")
        .select("action_type, status, lead_name, executed_at")
        .eq("organization_id", profile.organization_id)
        .gte("executed_at", startOfMonth.toISOString());

      if (!executions) return;

      const uniqueLeads = new Set(executions.filter(e => e.lead_name).map(e => e.lead_name));
      const msgActions = ["send_whatsapp", "send_email", "send_notification"];
      
      setStats(prev => ({
        ...prev,
        leadsImpacted: uniqueLeads.size,
        messagesSent: executions.filter(e => msgActions.includes(e.action_type)).length,
        tasksCreated: executions.filter(e => e.action_type === "create_task").length,
        conversions: executions.filter(e => e.action_type === "update_stage" && e.status === "success").length,
        avgResponseRate: executions.length > 0
          ? Math.round((executions.filter(e => e.status === "success").length / executions.length) * 100)
          : 0,
      }));
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchAutomations();
    fetchStats();
  }, [fetchAutomations, fetchStats]);

  // Update stats when automations change
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      totalActive: automations.filter(a => a.enabled).length,
      totalPaused: automations.filter(a => !a.enabled).length,
    }));
  }, [automations]);

  const toggleAutomation = useCallback(async (id: string) => {
    const target = automations.find(a => a.id === id);
    if (!target) return;
    const newEnabled = !target.enabled;

    // Optimistic update
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: newEnabled } : a));

    const { error } = await supabase
      .from("automations")
      .update({ enabled: newEnabled } as any)
      .eq("id", id);

    if (error) {
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !newEnabled } : a));
      toast.error("Erro ao atualizar automação");
    }
  }, [automations]);

  const deleteAutomation = useCallback(async (id: string) => {
    const prev = automations;
    setAutomations(a => a.filter(r => r.id !== id));

    const { error } = await supabase
      .from("automations")
      .delete()
      .eq("id", id);

    if (error) {
      setAutomations(prev);
      toast.error("Erro ao excluir automação");
    }
  }, [automations]);

  const duplicateAutomation = useCallback(async (id: string) => {
    const source = automations.find(a => a.id === id);
    if (!source || !profile?.organization_id || !profile?.id) return;

    const { data, error } = await supabase
      .from("automations")
      .insert({
        organization_id: profile.organization_id,
        name: `${source.name} (cópia)`,
        description: source.description ?? null,
        trigger_type: source.trigger.type,
        trigger_conditions: source.trigger.conditions ?? {},
        actions: source.actions as any,
        enabled: false,
        created_by: profile.id,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao duplicar automação");
      return;
    }
    if (data) {
      setAutomations(prev => [dbToRule(data as unknown as DbAutomation), ...prev]);
    }
  }, [automations, profile?.organization_id, profile?.id]);

  const addAutomation = useCallback(async (
    rule: Omit<AutomationRule, "id" | "created_at" | "updated_at">
  ) => {
    if (!profile?.organization_id || !profile?.id) return;

    const { data, error } = await supabase
      .from("automations")
      .insert({
        organization_id: profile.organization_id,
        name: rule.name,
        description: rule.description ?? null,
        trigger_type: rule.trigger.type,
        trigger_conditions: rule.trigger.conditions ?? {},
        actions: rule.actions as any,
        enabled: rule.enabled,
        created_by: profile.id,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar automação");
      return;
    }
    if (data) {
      setAutomations(prev => [dbToRule(data as unknown as DbAutomation), ...prev]);
    }
  }, [profile?.organization_id, profile?.id]);

  const maxAutomations = automationsLimit ?? Infinity;
  const canCreate = automations.filter(a => a.enabled).length < maxAutomations;

  return {
    automations,
    stats,
    plan,
    canCreate,
    maxAutomations,
    loading,
    toggleAutomation,
    deleteAutomation,
    duplicateAutomation,
    addAutomation,
    refetch: fetchAutomations,
  };
}
