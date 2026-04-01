import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Clock, MessageSquare, Brain, Users, RefreshCw, UserPlus, AlertTriangle } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

interface WhatsAppContact {
  remote_jid: string;
  last_message: string | null;
  last_timestamp: string;
  last_from_me: boolean;
  last_sender_type: string;
  hours_since_last: number;
  in_queue: boolean;
  queue_status: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "default" },
  responded: { label: "Respondeu", variant: "secondary" },
  completed: { label: "Concluído", variant: "outline" },
  opted_out: { label: "Opt-out", variant: "destructive" },
};

function formatJid(jid: string): string {
  const phone = jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
}

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
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

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

  const loadContacts = async () => {
    if (!profile?.organization_id) return;
    setLoadingContacts(true);

    // Fetch recent WhatsApp messages
    const { data: messages } = await supabase
      .from("whatsapp_messages" as any)
      .select("remote_jid, from_me, sender_type, message_text, timestamp")
      .eq("organization_id", profile.organization_id)
      .order("timestamp", { ascending: false })
      .limit(2000);

    // Fetch current queue
    const { data: queueData } = await supabase
      .from("follow_up_queue" as any)
      .select("lead_phone, status")
      .eq("org_id", profile.organization_id);

    const queueMap = new Map<string, string>();
    if (queueData) {
      for (const q of queueData as any[]) {
        queueMap.set(q.lead_phone, q.status);
      }
    }

    // Group messages by contact
    const contactMap = new Map<string, WhatsAppContact>();
    if (messages) {
      for (const msg of messages as any[]) {
        if (msg.remote_jid.includes("@g.us")) continue; // skip groups
        if (!contactMap.has(msg.remote_jid)) {
          const hoursSince = (Date.now() - new Date(msg.timestamp).getTime()) / (1000 * 60 * 60);
          contactMap.set(msg.remote_jid, {
            remote_jid: msg.remote_jid,
            last_message: msg.message_text,
            last_timestamp: msg.timestamp,
            last_from_me: msg.from_me,
            last_sender_type: msg.sender_type,
            hours_since_last: Math.round(hoursSince * 10) / 10,
            in_queue: queueMap.has(msg.remote_jid),
            queue_status: queueMap.get(msg.remote_jid) ?? null,
          });
        }
      }
    }

    setContacts(Array.from(contactMap.values()).sort((a, b) => 
      new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()
    ));
    setLoadingContacts(false);
  };

  useEffect(() => {
    loadQueue();
    loadContacts();
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

  const handleManualEnqueue = async (contact: WhatsAppContact) => {
    if (!profile?.organization_id || !config) return;
    const { error } = await supabase
      .from("follow_up_queue" as any)
      .upsert({
        org_id: profile.organization_id,
        lead_phone: contact.remote_jid,
        lead_name: contact.remote_jid.replace("@s.whatsapp.net", ""),
        instance_name: (config as any).instance_name ?? "",
        status: "pending",
        attempt_count: 0,
        next_followup_at: new Date().toISOString(),
        opted_out: false,
      } as any, { onConflict: "org_id,lead_phone" } as any);

    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
    } else {
      toast.success("Lead adicionado à fila de follow-up!");
      loadQueue();
      loadContacts();
    }
  };

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  // Contacts that are stale (last msg was outbound, >X hours ago)
  const firstInterval = intervals[0] ?? 24;
  const staleContacts = contacts.filter(
    (c) => c.last_from_me && c.hours_since_last >= firstInterval && !c.in_queue
  );
  const waitingContacts = contacts.filter(
    (c) => c.last_from_me && c.hours_since_last < firstInterval && !c.in_queue
  );
  const respondedContacts = contacts.filter((c) => !c.last_from_me);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="contacts" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Contatos ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Fila ({queue.filter(q => q.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Configuração
          </TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          {/* Stale contacts alert */}
          {staleContacts.length > 0 && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4" />
                  {staleContacts.length} contato(s) sem resposta há mais de {firstInterval}h
                </CardTitle>
                <CardDescription className="text-xs">
                  Esses contatos receberam sua última mensagem há mais de {firstInterval} horas e não responderam. 
                  {enabled ? " O sistema automático os adicionará à fila." : " Ative o follow-up automático ou adicione manualmente."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {staleContacts.map((c) => (
                    <div key={c.remote_jid} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border border-border/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{formatJid(c.remote_jid)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Última msg: {formatDistanceToNow(new Date(c.last_timestamp), { addSuffix: true, locale: ptBR })}
                          {" · "}{c.last_sender_type === "agent" ? "Agente IA" : "Humano"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleManualEnqueue(c)} className="shrink-0 ml-2">
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Enfileirar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All contacts table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Todos os Contatos WhatsApp
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={loadContacts} disabled={loadingContacts}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingContacts ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
              <CardDescription>
                Contatos com conversas ativas. O follow-up automático detecta quem não respondeu após {firstInterval}h.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma conversa WhatsApp encontrada
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-3">Contato</th>
                        <th className="pb-2 pr-3">Última mensagem</th>
                        <th className="pb-2 pr-3">Tempo</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => {
                        const isStale = c.last_from_me && c.hours_since_last >= firstInterval;
                        return (
                          <tr key={c.remote_jid} className={`border-b border-border/50 ${isStale && !c.in_queue ? "bg-orange-500/5" : ""}`}>
                            <td className="py-2 pr-3">
                              <span className="font-medium text-xs">{formatJid(c.remote_jid)}</span>
                            </td>
                            <td className="py-2 pr-3 text-xs max-w-[200px] truncate text-muted-foreground">
                              {c.last_from_me ? "→ " : "← "}
                              {c.last_message?.substring(0, 50) || "—"}
                            </td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(c.last_timestamp), { addSuffix: true, locale: ptBR })}
                            </td>
                            <td className="py-2 pr-3">
                              {c.in_queue ? (
                                <Badge variant={STATUS_MAP[c.queue_status ?? ""]?.variant ?? "outline"} className="text-xs">
                                  {STATUS_MAP[c.queue_status ?? ""]?.label ?? c.queue_status}
                                </Badge>
                              ) : c.last_from_me ? (
                                <Badge variant={isStale ? "destructive" : "outline"} className="text-xs">
                                  {isStale ? `Sem resposta ${Math.round(c.hours_since_last)}h` : "Aguardando"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Respondeu</Badge>
                              )}
                            </td>
                            <td className="py-2">
                              {!c.in_queue && c.last_from_me && isStale && (
                                <Button size="sm" variant="ghost" onClick={() => handleManualEnqueue(c)} className="h-7 text-xs">
                                  <UserPlus className="h-3 w-3 mr-1" /> Enfileirar
                                </Button>
                              )}
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
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue">
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
              <CardDescription>
                Leads enfileirados para follow-up automático via N8N a cada 5 minutos.
              </CardDescription>
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
                              <div className="text-xs text-muted-foreground">{formatJid(item.lead_phone)}</div>
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
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4">
          {/* Toggle + Intervals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Configuração de Follow-up
              </CardTitle>
              <CardDescription>
                O sistema detecta automaticamente conversas sem resposta e enfileira para follow-up progressivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativar Follow-up Automático</Label>
                  <p className="text-xs text-muted-foreground">
                    O N8N processará a fila a cada 5 minutos. Contatos sem resposta após o intervalo configurado serão enfileirados automaticamente.
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

                  <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground space-y-1">
                    <p><strong>Como funciona:</strong></p>
                    <p>1. Quando um contato não responde por <strong>{intervals[0]}h</strong>, ele é detectado automaticamente</p>
                    <p>2. A 1ª tentativa usa o <strong>template fixo</strong>. Após <strong>{intervals[1] ?? 48}h</strong> sem resposta, a 2ª tentativa usa <strong>IA</strong></p>
                    <p>3. Após mais <strong>{intervals[2] ?? 72}h</strong>, a 3ª e última tentativa é a <strong>mensagem de despedida</strong></p>
                    <p>4. Se o lead responder a qualquer momento, o follow-up <strong>para imediatamente</strong></p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
