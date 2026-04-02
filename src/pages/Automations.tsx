import { useState, useEffect } from "react";
import { Plus, Zap, BarChart3, History, LayoutTemplate, MessageSquare, UserCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PillBadge } from "@/components/ui/pill-badge";
import { AutomationDashboard } from "@/components/automations/AutomationDashboard";
import { AutomationList } from "@/components/automations/AutomationList";
import { AutomationWizard } from "@/components/automations/AutomationWizard";
import { AutomationStatsPanel } from "@/components/automations/AutomationStats";
import { AutomationExecutionLog, type ExecutionLogEntry } from "@/components/automations/AutomationExecutionLog";
import { AutomationTemplates } from "@/components/automations/AutomationTemplates";
import { LeadScoreConfig } from "@/components/automations/LeadScoreConfig";
import { WhatsAppAgentPanel } from "@/components/integrations/whatsapp-agent/WhatsAppAgentPanel";
import { FollowUpConfigPanel } from "@/components/automations/FollowUpConfigPanel";
import { FeatureFlagGate } from "@/components/FeatureGate";
import { useAutomations } from "@/hooks/useAutomations";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Automations() {
  const {
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
  } = useAutomations();

  const { profile } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch execution logs from database
  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchLogs = async () => {
      setLogsLoading(true);
      try {
        const { data, error } = await supabase
          .from("automation_executions")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .order("executed_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        const logs: ExecutionLogEntry[] = (data ?? []).map((row: any) => ({
          id: row.id,
          automationName: row.automation_name,
          triggerType: row.trigger_type,
          status: row.status as 'success' | 'error' | 'pending',
          actionType: row.action_type,
          leadName: row.lead_name ?? undefined,
          executedAt: row.executed_at,
          errorMessage: row.error_message ?? undefined,
        }));

        setExecutionLogs(logs);
      } catch (err) {
        console.error("Error fetching execution logs:", err);
      } finally {
        setLogsLoading(false);
      }
    };

    fetchLogs();
  }, [profile?.organization_id]);

  const selectedAutomation = selectedAutomationId
    ? automations.find((a) => a.id === selectedAutomationId)
    : null;

  const handleCreate = () => {
    if (!canCreate) {
      toast({
        title: "Limite atingido",
        description: `Seu plano permite apenas ${maxAutomations} automações ativas. Faça upgrade para Pro.`,
        variant: "destructive",
      });
      return;
    }
    setShowWizard(true);
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />

      <PageHeader
        title="Automações"
        description="Automatize tarefas e aumente suas conversões"
        actions={
          <div className="flex items-center gap-2">
            <PillBadge size="sm" variant={plan === "free" ? "muted" : "default"}>
              {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Enterprise"}
            </PillBadge>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Automação
            </Button>
          </div>
        }
      />

      <div className="relative flex-1 p-4 sm:p-6 space-y-6">
        {showWizard && (
          <div className="mb-6">
            <AutomationWizard
              onSave={(rule) => {
                addAutomation(rule);
                setShowWizard(false);
                toast({ title: "Automação criada!", description: rule.name });
              }}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        )}

        {selectedAutomation && !showWizard && (
          <AutomationStatsPanel
            automation={selectedAutomation}
            onClose={() => setSelectedAutomationId(null)}
          />
        )}

        {!showWizard && !selectedAutomation && (
          <Tabs defaultValue="automations" className="space-y-4">
            <TabsList className="bg-muted/50 overflow-x-auto flex-nowrap w-full">
              <TabsTrigger value="automations" className="gap-1.5 shrink-0">
                <Zap className="h-3.5 w-3.5" /> Automações
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5 shrink-0">
                <LayoutTemplate className="h-3.5 w-3.5" /> Templates
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 shrink-0">
                <History className="h-3.5 w-3.5" /> Logs
              </TabsTrigger>
              <TabsTrigger value="score" className="gap-1.5 shrink-0">
                <BarChart3 className="h-3.5 w-3.5" /> Score
              </TabsTrigger>
              <TabsTrigger value="whatsapp-agent" className="gap-1.5 shrink-0">
                <MessageSquare className="h-3.5 w-3.5" /> Agente IA (WhatsApp)
              </TabsTrigger>
              <TabsTrigger value="followup" className="gap-1.5 shrink-0">
                <UserCheck className="h-3.5 w-3.5" /> Follow-up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="automations" className="space-y-6">
              <AutomationDashboard stats={stats} />
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <AutomationList
                  automations={automations}
                  plan={plan}
                  onToggle={toggleAutomation}
                  onDelete={(id) => {
                    deleteAutomation(id);
                    toast({ title: "Automação excluída" });
                  }}
                  onDuplicate={(id) => {
                    duplicateAutomation(id);
                    toast({ title: "Automação duplicada" });
                  }}
                  onViewStats={setSelectedAutomationId}
                />
              )}
            </TabsContent>

            <TabsContent value="templates">
              <AutomationTemplates
                onUseTemplate={(templateId) => {
                  handleCreate();
                  toast({ title: "Template selecionado", description: "Configure os detalhes da automação." });
                }}
                currentPlan={plan}
              />
            </TabsContent>

            <TabsContent value="logs">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <AutomationExecutionLog logs={executionLogs} />
              )}
            </TabsContent>

            <TabsContent value="score">
              <LeadScoreConfig />
            </TabsContent>

            <TabsContent value="whatsapp-agent">
              <FeatureFlagGate featureKey="has_whatsapp">
                <WhatsAppAgentPanel />
              </FeatureFlagGate>
            </TabsContent>
            <TabsContent value="followup">
              <FeatureFlagGate featureKey="has_whatsapp">
                <FollowUpConfigPanel />
              </FeatureFlagGate>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
