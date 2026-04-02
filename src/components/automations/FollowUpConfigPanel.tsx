import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Save, Clock, MessageSquare, Brain, Users, RefreshCw,
  AlertTriangle, Send, History, StopCircle, PlayCircle, Search,
  ChevronLeft, ChevronRight, Plus, Trash2, GripVertical,
} from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ── Types ──
interface ContactRow {
  organization_id: string;
  remote_jid: string;
  last_message_at: string;
  last_message_text: string | null;
  last_sender_type: string | null;
  last_from_me: boolean;
  total_messages: number;
  display_name: string;
  followup_id: string | null;
  followup_status: string | null;
  attempt_count: number | null;
  next_followup_at: string | null;
  followup_last_outbound: string | null;
  followup_last_inbound: string | null;
  opted_out: boolean | null;
  property_interest: string | null;
  conversation_context: string | null;
}

interface LogEntry {
  id: string;
  attempt_number: number;
  message_sent: string;
  message_source: string;
  sent_at: string;
  delivery_status: string;
}

interface FollowUpQueueItem {
  id: string;
  lead_phone: string;
  lead_name: string | null;
  property_interest: string | null;
  status: string;
  attempt_count: number;
  next_followup_at: string;
  created_at: string;
  opted_out: boolean;
}

export interface FollowUpTemplate {
  type: "template" | "ai" | "farewell";
  message: string;
}

// ── Helpers ──
const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "default" },
  responded: { label: "Respondeu", variant: "secondary" },
  completed: { label: "Concluído", variant: "outline" },
  opted_out: { label: "Opt-out", variant: "destructive" },
};

const SOURCE_LABELS: Record<string, string> = {
  template_1: "Template 1",
  template: "Template",
  ai_generated: "IA",
  ai: "IA",
  template_3: "Template 3",
  farewell: "Despedida",
  manual: "Manual",
};

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  template: { label: "Template fixo", icon: <MessageSquare className="h-3.5 w-3.5" />, description: "Mensagem fixa com variáveis" },
  ai: { label: "IA generativa", icon: <Brain className="h-3.5 w-3.5 text-primary" />, description: "Prompt para gerar mensagem personalizada" },
  farewell: { label: "Despedida", icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />, description: "Última mensagem do ciclo" },
};

function formatJid(jid: string): string {
  const phone = jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
  if (phone.length >= 12) {
    return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
}

const PAGE_SIZE = 20;

function buildDefaultTemplates(count: number): FollowUpTemplate[] {
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) return { type: "template" as const, message: "" };
    if (i === count - 1) return { type: "farewell" as const, message: "" };
    return { type: "ai" as const, message: "" };
  });
}

// ── Component ──
export function FollowUpConfigPanel() {
  const { config, saveConfig, isSaving, isLoading } = useWhatsAppAgentConfig();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  // Config state
  const [enabled, setEnabled] = useState(false);
  const [intervals, setIntervals] = useState<number[]>([24, 48, 72]);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [bhStart, setBhStart] = useState("08:00");
  const [bhEnd, setBhEnd] = useState("18:00");
  const [templates, setTemplates] = useState<FollowUpTemplate[]>(buildDefaultTemplates(3));

  // Legacy fields (kept for backward compat)
  const [template1, setTemplate1] = useState("");
  const [template3, setTemplate3] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");

  // Contacts state
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);

  // Queue state
  const [queue, setQueue] = useState<FollowUpQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Modal: manual follow-up
  const [manualContact, setManualContact] = useState<ContactRow | null>(null);
  const [manualMessage, setManualMessage] = useState("");
  const [sendingManual, setSendingManual] = useState(false);

  // Sheet: history
  const [historyContact, setHistoryContact] = useState<ContactRow | null>(null);
  const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Sync config ──
  useEffect(() => {
    if (config) {
      setEnabled((config as any).followup_enabled ?? false);
      const savedIntervals = (config as any).followup_intervals ?? [24, 48, 72];
      setIntervals(savedIntervals);
      const savedMax = (config as any).followup_max_attempts ?? 3;
      setMaxAttempts(savedMax);
      const bh = (config as any).followup_business_hours as { start: string; end: string } | null;
      setBhStart(bh?.start ?? "08:00");
      setBhEnd(bh?.end ?? "18:00");

      // Load new templates format or migrate from legacy
      const savedTemplates = (config as any).followup_templates as FollowUpTemplate[] | null;
      if (savedTemplates && savedTemplates.length > 0) {
        setTemplates(savedTemplates);
      } else {
        // Migrate from legacy columns
        const t1 = (config as any).followup_template_1 ?? "";
        const t3 = (config as any).followup_template_3 ?? "";
        const ai = (config as any).followup_ai_prompt ?? "";
        setTemplate1(t1);
        setTemplate3(t3);
        setAiPrompt(ai);

        const migrated: FollowUpTemplate[] = [];
        for (let i = 0; i < savedMax; i++) {
          if (i === 0) migrated.push({ type: "template", message: t1 });
          else if (i === savedMax - 1) migrated.push({ type: "farewell", message: t3 });
          else migrated.push({ type: "ai", message: ai });
        }
        setTemplates(migrated);
      }
    }
  }, [config]);

  // ── Sync intervals array length with maxAttempts ──
  useEffect(() => {
    if (intervals.length < maxAttempts) {
      const lastVal = intervals[intervals.length - 1] ?? 24;
      setIntervals([...intervals, ...Array(maxAttempts - intervals.length).fill(lastVal + 24)]);
    } else if (intervals.length > maxAttempts) {
      setIntervals(intervals.slice(0, maxAttempts));
    }
  }, [maxAttempts]);

  useEffect(() => {
    if (templates.length < maxAttempts) {
      const newTemplates = [...templates];
      while (newTemplates.length < maxAttempts) {
        newTemplates.push({ type: "template", message: "" });
      }
      setTemplates(newTemplates);
    } else if (templates.length > maxAttempts) {
      setTemplates(templates.slice(0, maxAttempts));
    }
  }, [maxAttempts]);

  // ── Load contacts from view ──
  const loadContacts = useCallback(async () => {
    if (!orgId) return;
    setLoadingContacts(true);
    const { data, error } = await supabase
      .from("whatsapp_contacts_followup_view" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("last_message_at", { ascending: false })
      .limit(500);
    if (!error && data) setContacts(data as any as ContactRow[]);
    setLoadingContacts(false);
  }, [orgId]);

  // ── Load queue ──
  const loadQueue = useCallback(async () => {
    if (!orgId) return;
    setLoadingQueue(true);
    const { data } = await supabase
      .from("follow_up_queue" as any)
      .select("id, lead_phone, lead_name, property_interest, status, attempt_count, next_followup_at, created_at, opted_out")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    setQueue((data as any as FollowUpQueueItem[]) ?? []);
    setLoadingQueue(false);
  }, [orgId]);

  useEffect(() => {
    loadContacts();
    loadQueue();
  }, [loadContacts, loadQueue]);

  // ── Realtime on follow_up_queue ──
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("followup-queue-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "follow_up_queue",
        filter: `org_id=eq.${orgId}`,
      }, () => {
        loadQueue();
        loadContacts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, loadQueue, loadContacts]);

  // ── Filtered & paginated contacts ──
  const filteredContacts = contacts.filter((c) => {
    if (statusFilter === "pending" && c.followup_status !== "pending") return false;
    if (statusFilter === "responded" && c.followup_status !== "responded") return false;
    if (statusFilter === "completed" && c.followup_status !== "completed") return false;
    if (statusFilter === "opted_out" && c.followup_status !== "opted_out") return false;
    if (statusFilter === "none" && c.followup_id !== null) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!c.display_name.toLowerCase().includes(s) && !c.remote_jid.toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const totalPages = Math.ceil(filteredContacts.length / PAGE_SIZE);
  const pagedContacts = filteredContacts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Save config ──
  const handleSave = () => {
    // Also sync legacy columns for backward compatibility with edge functions
    const t1 = templates[0]?.message ?? "";
    const t3 = templates[templates.length - 1]?.message ?? "";
    const aiP = templates.find(t => t.type === "ai")?.message ?? "";

    saveConfig({
      followup_enabled: enabled,
      followup_intervals: intervals,
      followup_max_attempts: maxAttempts,
      followup_business_hours: { start: bhStart, end: bhEnd },
      followup_template_1: t1,
      followup_template_3: t3,
      followup_ai_prompt: aiP,
      followup_templates: templates,
    } as any);
  };

  // ── Template management ──
  const updateTemplate = (index: number, field: keyof FollowUpTemplate, value: string) => {
    const next = [...templates];
    if (field === "type") {
      next[index] = { ...next[index], type: value as FollowUpTemplate["type"] };
    } else {
      next[index] = { ...next[index], message: value };
    }
    setTemplates(next);
  };

  const updateInterval = (index: number, value: number) => {
    const next = [...intervals];
    next[index] = value;
    setIntervals(next);
  };

  // ── Manual follow-up ──
  const openManualModal = (contact: ContactRow) => {
    const name = contact.display_name !== contact.remote_jid ? contact.display_name : formatJid(contact.remote_jid);
    const firstTemplate = templates[0]?.message ?? "";
    const msg = firstTemplate
      .replace("{nome}", name)
      .replace("{imovel}", contact.property_interest ?? "imóvel");
    setManualMessage(msg);
    setManualContact(contact);
  };

  const sendManualFollowup = async () => {
    if (!orgId || !manualContact || !manualMessage.trim()) return;
    setSendingManual(true);

    const { data: upserted, error: upsertErr } = await supabase
      .from("follow_up_queue" as any)
      .upsert({
        org_id: orgId,
        lead_phone: manualContact.remote_jid,
        lead_name: manualContact.display_name !== manualContact.remote_jid ? manualContact.display_name : null,
        instance_name: (config as any).instance_name ?? "",
        status: "pending",
        attempt_count: 0,
        next_followup_at: new Date().toISOString(),
        opted_out: false,
      } as any, { onConflict: "org_id,lead_phone" } as any)
      .select("id")
      .single();

    if (upsertErr) {
      toast.error("Erro ao enfileirar: " + upsertErr.message);
      setSendingManual(false);
      return;
    }

    if (upserted) {
      await supabase.from("follow_up_log" as any).insert({
        queue_id: (upserted as any).id,
        org_id: orgId,
        lead_phone: manualContact.remote_jid,
        attempt_number: 0,
        message_sent: manualMessage,
        message_source: "manual",
      } as any);
    }

    toast.success("Follow-up enfileirado para envio!");
    setManualContact(null);
    setSendingManual(false);
    loadQueue();
    loadContacts();
  };

  // ── History ──
  const openHistory = async (contact: ContactRow) => {
    setHistoryContact(contact);
    setLoadingHistory(true);
    const { data } = await supabase
      .from("follow_up_log" as any)
      .select("id, attempt_number, message_sent, message_source, sent_at, delivery_status")
      .eq("org_id", orgId)
      .eq("lead_phone", contact.remote_jid)
      .order("sent_at", { ascending: false })
      .limit(50);
    setHistoryLogs((data as any as LogEntry[]) ?? []);
    setLoadingHistory(false);
  };

  // ── Opt-out ──
  const handleOptOut = async (contact: ContactRow) => {
    if (!contact.followup_id) return;
    const confirmed = window.confirm("Tem certeza que quer parar o follow-up para este contato?");
    if (!confirmed) return;

    const { error } = await supabase.functions.invoke("whatsapp-followup-update", {
      body: { id: contact.followup_id, action: "opted_out" },
    });
    if (error) toast.error("Erro: " + error.message);
    else toast.success("Follow-up interrompido.");
  };

  // ── Reactivate ──
  const handleReactivate = async (contact: ContactRow) => {
    if (!contact.followup_id) return;
    const nextAt = new Date(Date.now() + (intervals[0] ?? 24) * 3600 * 1000).toISOString();
    const { error } = await supabase
      .from("follow_up_queue" as any)
      .update({
        status: "pending",
        attempt_count: 0,
        opted_out: false,
        next_followup_at: nextAt,
      } as any)
      .eq("id", contact.followup_id);
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Follow-up reativado!");
      loadQueue();
      loadContacts();
    }
  };

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="contacts" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Fila ({queue.filter(q => q.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Configuração
          </TabsTrigger>
        </TabsList>

        {/* ═══ CONTACTS TAB ═══ */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Contatos WhatsApp
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={loadContacts} disabled={loadingContacts}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingContacts ? "animate-spin" : ""}`} /> Atualizar
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="responded">Respondeu</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="opted_out">Opt-out</SelectItem>
                    <SelectItem value="none">Sem follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pagedContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato encontrado</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contato</TableHead>
                          <TableHead className="hidden sm:table-cell">Última msg</TableHead>
                          <TableHead>Tempo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden sm:table-cell">Tentativas</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedContacts.map((c) => {
                          const canSendManual = enabled && !c.opted_out && (c.attempt_count ?? 0) < maxAttempts;
                          const canOptOut = c.followup_id && c.followup_status === "pending";
                          const canReactivate = c.followup_id && ["responded", "completed", "opted_out"].includes(c.followup_status ?? "");

                          return (
                            <TableRow key={c.remote_jid}>
                              <TableCell>
                                <div className="font-medium text-xs">
                                  {c.display_name !== c.remote_jid ? c.display_name : formatJid(c.remote_jid)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{formatJid(c.remote_jid)}</div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs text-muted-foreground max-w-[150px] truncate">
                                {c.last_message_text?.substring(0, 50) || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                {c.followup_status ? (
                                  <Badge
                                    variant={STATUS_MAP[c.followup_status]?.variant ?? "outline"}
                                    className="text-[10px]"
                                  >
                                    {STATUS_MAP[c.followup_status]?.label ?? c.followup_status}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs">
                                {c.followup_id ? `${c.attempt_count ?? 0}/${maxAttempts}` : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {canSendManual && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Enviar follow-up manual" onClick={() => openManualModal(c)}>
                                      <Send className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver histórico" onClick={() => openHistory(c)}>
                                    <History className="h-3.5 w-3.5" />
                                  </Button>
                                  {canOptOut && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Parar follow-up" onClick={() => handleOptOut(c)}>
                                      <StopCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {canReactivate && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Reativar follow-up" onClick={() => handleReactivate(c)}>
                                      <PlayCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        {filteredContacts.length} contato(s) · Página {page + 1}/{totalPages}
                      </span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ QUEUE TAB ═══ */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Fila de Follow-up
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={loadQueue} disabled={loadingQueue}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingQueue ? "animate-spin" : ""}`} /> Atualizar
                </Button>
              </div>
              <CardDescription>Leads enfileirados para follow-up automático via N8N a cada 5 minutos.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead na fila</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Interesse</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Próximo envio</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => {
                      const st = STATUS_MAP[item.status] ?? { label: item.status, variant: "outline" as const };
                      const canStop = item.status === "pending" && !item.opted_out;
                      const canRestart = ["responded", "completed", "opted_out"].includes(item.status);

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium text-xs">{item.lead_name || "Sem nome"}</div>
                            <div className="text-[10px] text-muted-foreground">{formatJid(item.lead_phone)}</div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{item.property_interest || "—"}</TableCell>
                          <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                          <TableCell className="text-xs text-center">{item.attempt_count}/{maxAttempts}</TableCell>
                          <TableCell className="text-xs">
                            {item.status === "pending"
                              ? format(new Date(item.next_followup_at), "dd/MM HH:mm", { locale: ptBR })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canStop && (
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                  title="Parar follow-up"
                                  onClick={async () => {
                                    const confirmed = window.confirm("Parar follow-up para este lead?");
                                    if (!confirmed) return;
                                    const { error } = await supabase.functions.invoke("whatsapp-followup-update", {
                                      body: { id: item.id, action: "opted_out" },
                                    });
                                    if (error) toast.error("Erro: " + error.message);
                                    else { toast.success("Follow-up parado."); loadQueue(); }
                                  }}
                                >
                                  <StopCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canRestart && (
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7 text-primary"
                                  title="Reativar follow-up"
                                  onClick={async () => {
                                    const nextAt = new Date(Date.now() + (intervals[0] ?? 24) * 3600 * 1000).toISOString();
                                    const { error } = await supabase
                                      .from("follow_up_queue" as any)
                                      .update({ status: "pending", attempt_count: 0, opted_out: false, next_followup_at: nextAt } as any)
                                      .eq("id", item.id);
                                    if (error) toast.error("Erro: " + error.message);
                                    else { toast.success("Follow-up reativado!"); loadQueue(); }
                                  }}
                                >
                                  <PlayCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ CONFIG TAB ═══ */}
        <TabsContent value="config" className="space-y-4">
          {/* General settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Configuração Geral
              </CardTitle>
              <CardDescription>Ative o follow-up automático e configure limites globais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Ativar Follow-up Automático</Label>
                  <p className="text-xs text-muted-foreground">Contatos sem resposta serão enfileirados automaticamente.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              {enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Máximo de tentativas</Label>
                      <Input
                        type="number" min={1} max={10} value={maxAttempts}
                        onChange={(e) => setMaxAttempts(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                        className="w-24"
                      />
                      <p className="text-[10px] text-muted-foreground">De 1 a 10 tentativas</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Horário comercial — início</Label>
                      <Input type="time" value={bhStart} onChange={(e) => setBhStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Horário comercial — fim</Label>
                      <Input type="time" value={bhEnd} onChange={(e) => setBhEnd(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attempts configuration */}
          {enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" /> Tentativas ({maxAttempts})
                </CardTitle>
                <CardDescription>
                  Configure cada tentativa individualmente. Use {"{nome}"}, {"{imovel}"} e {"{contexto}"} como variáveis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {templates.map((tpl, i) => {
                  const typeInfo = TYPE_LABELS[tpl.type] ?? TYPE_LABELS.template;
                  return (
                    <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-sm font-medium">Tentativa {i + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">Intervalo (horas)</Label>
                            <Input
                              type="number" min={1} max={720}
                              value={intervals[i] ?? 24}
                              onChange={(e) => updateInterval(i, parseInt(e.target.value) || 24)}
                              className="w-20 h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de mensagem</Label>
                        <Select value={tpl.type} onValueChange={(v) => updateTemplate(i, "type", v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="template">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5" /> Template fixo
                              </div>
                            </SelectItem>
                            <SelectItem value="ai">
                              <div className="flex items-center gap-2">
                                <Brain className="h-3.5 w-3.5 text-primary" /> IA generativa
                              </div>
                            </SelectItem>
                            <SelectItem value="farewell">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Despedida
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">{typeInfo.description}</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {tpl.type === "ai" ? "Prompt para a IA" : "Mensagem"}
                        </Label>
                        <Textarea
                          value={tpl.message}
                          onChange={(e) => updateTemplate(i, "message", e.target.value)}
                          rows={3}
                          placeholder={
                            tpl.type === "ai"
                              ? "Gere uma mensagem de follow-up personalizada para {nome} que se interessou em {imovel}..."
                              : tpl.type === "farewell"
                              ? "Última mensagem, {nome}! Estarei aqui caso precise..."
                              : "Oi {nome}! Vi que você se interessou em {imovel}..."
                          }
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground space-y-1">
                  <p><strong>Como funciona:</strong></p>
                  {templates.map((tpl, i) => (
                    <p key={i}>
                      {i + 1}. Após <strong>{intervals[i] ?? 24}h</strong> sem resposta →{" "}
                      {tpl.type === "template" ? "envia template fixo" : tpl.type === "ai" ? "gera mensagem com IA" : "envia mensagem de despedida"}
                    </p>
                  ))}
                  <p className="mt-1">• Se o lead responder, o follow-up <strong>para imediatamente</strong></p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Follow-up"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ MANUAL FOLLOW-UP MODAL ═══ */}
      <Dialog open={!!manualContact} onOpenChange={(open) => !open && setManualContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Follow-up Manual</DialogTitle>
          </DialogHeader>
          {manualContact && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Contato</Label>
                  <p className="text-sm font-medium">
                    {manualContact.display_name !== manualContact.remote_jid ? manualContact.display_name : formatJid(manualContact.remote_jid)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <p className="text-sm">{formatJid(manualContact.remote_jid)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={manualMessage} onChange={(e) => setManualMessage(e.target.value)} rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualContact(null)}>Cancelar</Button>
            <Button onClick={sendManualFollowup} disabled={sendingManual || !manualMessage.trim()}>
              <Send className="h-4 w-4 mr-1" /> {sendingManual ? "Enviando..." : "Enviar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ HISTORY SHEET ═══ */}
      <Sheet open={!!historyContact} onOpenChange={(open) => !open && setHistoryContact(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Histórico de Follow-up</SheetTitle>
            {historyContact && (
              <SheetDescription>
                {historyContact.display_name !== historyContact.remote_jid
                  ? historyContact.display_name
                  : formatJid(historyContact.remote_jid)}
                {" · "}{formatJid(historyContact.remote_jid)}
              </SheetDescription>
            )}
          </SheetHeader>

          {historyContact && (
            <div className="mt-4 space-y-4">
              <div className="p-3 rounded-md bg-muted/50 space-y-1 text-sm">
                {historyContact.property_interest && (
                  <p><span className="text-muted-foreground">Interesse:</span> {historyContact.property_interest}</p>
                )}
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {historyContact.followup_status ? (
                    <Badge variant={STATUS_MAP[historyContact.followup_status]?.variant ?? "outline"} className="text-[10px] ml-1">
                      {STATUS_MAP[historyContact.followup_status]?.label ?? historyContact.followup_status}
                    </Badge>
                  ) : "Sem follow-up"}
                </p>
                {historyContact.opted_out && (
                  <div className="flex items-center gap-1.5 text-destructive mt-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Este contato optou por não receber mensagens</span>
                  </div>
                )}
              </div>

              {loadingHistory ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tentativa registrada</p>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-border pl-3 pb-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          Tentativa {log.attempt_number}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {SOURCE_LABELS[log.message_source] ?? log.message_source}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {log.message_sent}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
