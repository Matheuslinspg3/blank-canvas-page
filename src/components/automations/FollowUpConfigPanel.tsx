import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Clock, MessageSquare, Brain, Users, RefreshCw } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowUpQueueItem {
  id: string;
  lead_phone: string;
  lead_name: string | null;
  property_interest: string | null;
  status: string;
  attempt_count: number;
  next_followup_at: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "default" },
  responded: { label: "Respondeu", variant: "secondary" },
  completed: { label: "Concluído", variant: "outline" },
  opted_out: { label: "Opt-out", variant: "destructive" },
};

export function FollowUpConfigPanel() {
  const { config, saveConfig, isSaving, isLoading } = useWhatsAppAgentConfig();
  const { profile } = useAuth();

  const [enabled, setEnabled] = useState(false);
  const [intervals, setIntervals] = useState<number[]>([24, 48, 72]);
  const [bhStart, setBhStart] = useState("08:00");
  const [bhEnd, setBhEnd] = useState("18:00");
  const [template1, setTemplate1] = useState("");
  const [template3, setTemplate3] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [queue, setQueue] = useState<FollowUpQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  useEffect(() => {
    if (config) {
      setEnabled((config as any).followup_enabled ?? false);
      setIntervals((config as any).followup_intervals ?? [24, 48, 72]);
      const bh = (config as any).followup_business_hours as { start: string; end: string } | null;
      setBhStart(bh?.start ?? "08:00");
      setBhEnd(bh?.end ?? "18:00");
      setTemplate1((config as any).followup_template_1 ?? "");
      setTemplate3((config as any).followup_template_3 ?? "");
      setAiPrompt((config as any).followup_ai_prompt ?? "");
    }
  }, [config]);

  const loadQueue = async () => {
    if (!profile?.organization_id) return;
    setLoadingQueue(true);
    const { data } = await supabase
      .from("follow_up_queue" as any)
      .select("id, lead_phone, lead_name, property_interest, status, attempt_count, next_followup_at, created_at")
      .eq("org_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setQueue((data as any as FollowUpQueueItem[]) ?? []);
    setLoadingQueue(false);
  };

  useEffect(() => {
    loadQueue();
  }, [profile?.organization_id]);

  const handleSave = () => {
    saveConfig({
      followup_enabled: enabled,
      followup_intervals: intervals,
      followup_business_hours: { start: bhStart, end: bhEnd },
      followup_template_1: template1,
      followup_template_3: template3,
      followup_ai_prompt: aiPrompt,
    } as any);
  };

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Toggle + Intervals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Configuração de Follow-up
          </CardTitle>
          <CardDescription>
            Envie mensagens automáticas para leads que não responderam. Máximo 3 tentativas com intervalos progressivos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Follow-up Automático</Label>
              <p className="text-xs text-muted-foreground">
                O N8N processará a fila a cada 5 minutos
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {intervals.map((val, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs">Tentativa {i + 1} (horas)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={val}
                      onChange={(e) => {
                        const next = [...intervals];
                        next[i] = parseInt(e.target.value) || 24;
                        setIntervals(next);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Horário comercial - início</Label>
                  <Input type="time" value={bhStart} onChange={(e) => setBhStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário comercial - fim</Label>
                  <Input type="time" value={bhEnd} onChange={(e) => setBhEnd(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> Templates de Mensagem
            </CardTitle>
            <CardDescription>
              Use {"{nome}"} e {"{imovel}"} como variáveis. A tentativa 2 usa IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tentativa 1 — Mensagem fixa</Label>
              <Textarea
                value={template1}
                onChange={(e) => setTemplate1(e.target.value)}
                rows={3}
                placeholder="Oi {nome}! Vi que você se interessou..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <Label>Tentativa 2 — Prompt para IA</Label>
              </div>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={3}
                placeholder="Gere uma mensagem de follow-up personalizada..."
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{nome}"}, {"{imovel}"}, {"{contexto}"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tentativa 3 — Mensagem de despedida</Label>
              <Textarea
                value={template3}
                onChange={(e) => setTemplate3(e.target.value)}
                rows={3}
                placeholder="Última mensagem, {nome}!..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Follow-up"}
        </Button>
      </div>

      {/* Queue table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Fila de Follow-up
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadQueue} disabled={loadingQueue}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingQueue ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum lead na fila de follow-up
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3">Lead</th>
                    <th className="pb-2 pr-3">Interesse</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Tentativas</th>
                    <th className="pb-2">Próximo envio</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => {
                    const st = STATUS_MAP[item.status] ?? { label: item.status, variant: "outline" as const };
                    return (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{item.lead_name || "Sem nome"}</div>
                          <div className="text-xs text-muted-foreground">{item.lead_phone}</div>
                        </td>
                        <td className="py-2 pr-3 text-xs max-w-[200px] truncate">
                          {item.property_interest || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-center">{item.attempt_count}/3</td>
                        <td className="py-2 text-xs">
                          {item.status === "pending"
                            ? format(new Date(item.next_followup_at), "dd/MM HH:mm", { locale: ptBR })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
