import { useState, useEffect } from "react";
import { Plus, Zap, BarChart3, History, LayoutTemplate, Loader2, Phone, MessageCircle } from "lucide-react";
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
import { RetellVoicePanel } from "@/components/automations/retell/RetellVoicePanel";
import { useAutomations } from "@/hooks/useAutomations";
import { useWhatsAppV2 } from "@/hooks/useWhatsAppV2";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { WhatsAppStatusBanner } from "@/components/automations/WhatsAppStatusBanner";
import { WhatsAppAgentConnection } from "@/components/automations/WhatsAppAgentConnection";

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
        <WhatsAppStatusBanner />

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
          <Tabs defaultValue="whatsapp-agent" className="space-y-4">
            <TabsList className="bg-muted/50 overflow-x-auto flex-nowrap w-full">
              <TabsTrigger value="whatsapp-agent" className="gap-1.5 shrink-0">
                <MessageCircle className="h-3.5 w-3.5" /> Agente de IA (WhatsApp)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="whatsapp-agent" className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
              <WhatsAppAgentConnection />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}