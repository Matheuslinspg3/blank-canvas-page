import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageCircle, Send, ArrowLeft, User, Plus, Bot, UserPlus, Loader2, CheckCircle2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWhatsAppChat } from "@/hooks/useWhatsAppChat";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useUserRoles } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AudioMessageBubble } from "./AudioMessageBubble";
import { AudioRecorder } from "./AudioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";


export function WhatsAppChatPanel() {
  const {
    conversations,
    selectedJid,
    setSelectedJid,
    selectedMessages,
    sendMessage,
    sendToPhone,
    isSending,
    isLoading,
  } = useWhatsAppChat();

  const { isAdmin, isSubAdmin, isDeveloper, isLoading: rolesLoading } = useUserRoles();
  const { profile } = useAuth();
  const canSeeCosts = rolesLoading ? false : (isAdmin || isSubAdmin || isDeveloper);
  const orgId = profile?.organization_id;

  const [draft, setDraft] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", email: "", notes: "", temperature: "morno" });
  const [creatingLead, setCreatingLead] = useState(false);
  const { instance } = useWhatsAppInstance();

  // Lead lookup for selected conversation
  const selectedPhone = selectedJid
    ? selectedJid.replace("@s.whatsapp.net", "").replace("@c.us", "")
    : null;

  const { data: existingLead, isLoading: leadLookupLoading } = useQuery({
    queryKey: ["lead-lookup", selectedPhone, orgId],
    queryFn: async () => {
      if (!selectedPhone || !orgId) return null;
      const last8 = selectedPhone.slice(-8);
      const { data } = await supabase
        .from("leads")
        .select("id, name")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .ilike("phone", `%${last8}`)
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!selectedPhone && !!orgId,
    staleTime: 15000,
  });

  // Total cost for the selected chat
  const totalChatCost = useMemo(() => {
    if (!canSeeCosts) return 0;
    return selectedMessages.reduce((sum, m) => sum + (m.estimated_cost_usd || 0), 0);
  }, [selectedMessages, canSeeCosts]);

  const handleCreateLead = useCallback(async () => {
    if (!selectedJid) return;
    const phone = selectedJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (!phone) return;
    setCreatingLead(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-create-lead", {
        body: {
          phone,
          name: leadForm.name || `WhatsApp ${phone}`,
          email: leadForm.email || undefined,
          notes: leadForm.notes || undefined,
          temperature: leadForm.temperature,
          source: "whatsapp",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Lead cadastrado!");
      setShowCreateLead(false);
      setLeadForm({ name: "", email: "", notes: "", temperature: "morno" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar lead");
    } finally {
      setCreatingLead(false);
    }
  }, [selectedJid, leadForm]);

  const handleAudioRecorded = useCallback(async (blob: Blob) => {
    if (!selectedJid) return;
    setSendingAudio(true);
    try {
      const phone = selectedJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
      formData.append("phone", phone);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send-audio`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar áudio");
      }

      toast.success("Áudio enviado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar áudio");
    } finally {
      setSendingAudio(false);
    }
  }, [selectedJid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedMessages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft("");
  };

  const handleNewChatSend = () => {
    const phone = newPhone.replace(/\D/g, "");
    const msg = newMessage.trim();
    if (!phone || phone.length < 10) {
      toast.error("Informe um número válido (com DDD).");
      return;
    }
    if (!msg) {
      toast.error("Digite uma mensagem.");
      return;
    }
    sendToPhone(phone, msg);
    setShowNewChat(false);
    setNewPhone("");
    setNewMessage("");
    const jid = `${phone}@s.whatsapp.net`;
    setSelectedJid(jid);
  };

  const formatJid = (jid: string) => {
    const num = jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
    if (num.length >= 12) {
      return `+${num.slice(0, 2)} (${num.slice(2, 4)}) ${num.slice(4, 9)}-${num.slice(9)}`;
    }
    return num;
  };

  const formatCost = (costUsd: number) => {
    const brl = costUsd * 5.5; // USD → BRL aproximado
    if (brl < 0.01) return `R$ ${brl.toFixed(6)}`;
    return `R$ ${brl.toFixed(4)}`;
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm p-4">Carregando conversas...</div>;
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex h-[500px] sm:h-[600px]">
          {/* Conversation list */}
          <div
            className={cn(
              "border-r border-border flex flex-col",
              selectedJid ? "hidden sm:flex sm:w-72" : "w-full sm:w-72"
            )}
          >
            <CardHeader className="py-3 px-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Conversas ({conversations.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowNewChat(true)}
                  title="Nova mensagem"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-muted-foreground text-xs">
                    Nenhuma conversa ainda.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.remote_jid}
                    onClick={() => setSelectedJid(conv.remote_jid)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                      selectedJid === conv.remote_jid && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {formatJid(conv.remote_jid)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message || "Sem mensagem"}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(conv.last_timestamp), "HH:mm")}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Chat area */}
          <div
            className={cn(
              "flex-1 flex flex-col",
              !selectedJid && "hidden sm:flex"
            )}
          >
            {selectedJid ? (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden h-8 w-8"
                    onClick={() => setSelectedJid(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm flex-1">{formatJid(selectedJid)}</span>

                  {/* Cost total for chat - admin only */}
                  {canSeeCosts && totalChatCost > 0 && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCost(totalChatCost)}
                    </Badge>
                  )}

                  {/* Smart Lead Button */}
                  {existingLead ? (
                    <Badge variant="secondary" className="gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Lead Cadastrado
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setShowCreateLead(true)}
                      disabled={leadLookupLoading}
                    >
                      {leadLookupLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Cadastrar Lead
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="space-y-2">
                    {(() => {
                      // Group consecutive image messages from same sender into galleries
                      const groups: Array<{ type: "single"; msg: typeof selectedMessages[0] } | { type: "gallery"; msgs: typeof selectedMessages }> = [];
                      
                      for (let i = 0; i < selectedMessages.length; i++) {
                        const msg = selectedMessages[i];
                        if (msg.message_type === "image" && msg.media_url) {
                          // Check if previous group is a gallery from same sender
                          const lastGroup = groups[groups.length - 1];
                          if (lastGroup?.type === "gallery" && lastGroup.msgs[0].from_me === msg.from_me) {
                            lastGroup.msgs.push(msg);
                          } else if (lastGroup?.type === "single" && lastGroup.msg.message_type === "image" && lastGroup.msg.media_url && lastGroup.msg.from_me === msg.from_me) {
                            // Convert previous single image to gallery
                            groups[groups.length - 1] = { type: "gallery", msgs: [lastGroup.msg, msg] };
                          } else {
                            groups.push({ type: "single", msg });
                          }
                        } else {
                          groups.push({ type: "single", msg });
                        }
                      }

                      return groups.map((group, gi) => {
                        if (group.type === "gallery") {
                          const msgs = group.msgs;
                          const fromMe = msgs[0].from_me;
                          const isAgent = fromMe && msgs[0].sender_type === "agent";
                          // Find caption from first message that has one
                          const captionMsg = msgs.find(m => m.message_text && m.message_text !== "[Imagem enviada]");
                          
                          return (
                            <div key={`gallery-${gi}`} className={cn("flex", fromMe ? "justify-end" : "justify-start")}>
                              <div className={cn("max-w-[85%] rounded-lg px-2 py-2 text-sm", fromMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                                {isAgent && (
                                  <Badge variant="outline" className="mb-1 text-[10px] px-1.5 py-0 border-primary-foreground/30 text-primary-foreground/80">
                                    <Bot className="h-3 w-3 mr-0.5" /> Agente IA
                                  </Badge>
                                )}
                                {captionMsg?.message_text && (
                                  <p className="whitespace-pre-wrap break-words text-xs mb-1.5 px-1">{captionMsg.message_text}</p>
                                )}
                                <div className={cn(
                                  "grid gap-1 rounded overflow-hidden",
                                  msgs.length === 2 ? "grid-cols-2" : msgs.length >= 3 ? "grid-cols-3" : "grid-cols-1"
                                )}>
                                  {msgs.map((m) => (
                                    <img
                                      key={m.id}
                                      src={m.media_url!}
                                      alt="Imagem"
                                      className="w-full h-24 object-cover cursor-pointer rounded-sm hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(m.media_url!, "_blank")}
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1 px-1">
                                  <p className={cn("text-[10px]", fromMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                    {format(new Date(msgs[msgs.length - 1].timestamp), "HH:mm")} · {msgs.length} fotos
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const msg = group.msg;
                        return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.from_me ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                            msg.from_me
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {msg.from_me && msg.sender_type === "agent" && (
                            <Badge variant="outline" className="mb-1 text-[10px] px-1.5 py-0 border-primary-foreground/30 text-primary-foreground/80">
                              <Bot className="h-3 w-3 mr-0.5" /> Agente IA
                            </Badge>
                          )}
                          {msg.message_type === "audio" && msg.media_url ? (
                            <AudioMessageBubble url={msg.media_url} fromMe={msg.from_me} transcription={msg.message_text} />
                          ) : msg.message_type === "image" && msg.media_url ? (
                            <div className="space-y-1">
                              <img
                                src={msg.media_url}
                                alt={msg.message_text || "Imagem"}
                                className="rounded-md max-w-full max-h-64 object-cover cursor-pointer"
                                onClick={() => window.open(msg.media_url!, "_blank")}
                                loading="lazy"
                              />
                              {msg.message_text && msg.message_text !== "[Imagem enviada]" && (
                                <p className="whitespace-pre-wrap break-words text-xs opacity-80">{msg.message_text}</p>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.message_text}</p>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p
                              className={cn(
                                "text-[10px]",
                                msg.from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}
                            >
                              {format(new Date(msg.timestamp), "HH:mm")}
                            </p>
                            {canSeeCosts && msg.estimated_cost_usd != null && msg.estimated_cost_usd > 0 && (
                              <span
                                className={cn(
                                  "text-[10px] font-mono",
                                  msg.from_me ? "text-primary-foreground/50" : "text-muted-foreground/60"
                                )}
                              >
                                {formatCost(msg.estimated_cost_usd)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="px-4 py-3 border-t border-border flex gap-2 items-center">
                  <AudioRecorder
                    onRecorded={handleAudioRecorded}
                    disabled={isSending}
                    isSending={sendingAudio}
                  />
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                    disabled={isSending}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={isSending || !draft.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
                <p>Selecione uma conversa</p>
                <Button variant="outline" size="sm" onClick={() => setShowNewChat(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Nova mensagem
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* New chat dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Número (com DDD)</label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="5511999999999"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Mensagem</label>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Olá, tudo bem?"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleNewChatSend()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChat(false)}>Cancelar</Button>
            <Button onClick={handleNewChatSend} disabled={isSending}>
              <Send className="h-4 w-4 mr-1" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Lead dialog */}
      <Dialog open={showCreateLead} onOpenChange={setShowCreateLead}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Cadastrar Lead no CRM
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Telefone</Label>
              <Input
                value={selectedJid ? formatJid(selectedJid) : ""}
                disabled
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={leadForm.name}
                onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do contato"
                className="mt-1"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                value={leadForm.email}
                onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Temperatura</Label>
              <Select
                value={leadForm.temperature}
                onValueChange={(v) => setLeadForm(prev => ({ ...prev, temperature: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frio">🔵 Frio</SelectItem>
                  <SelectItem value="morno">🟡 Morno</SelectItem>
                  <SelectItem value="quente">🔴 Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={leadForm.notes}
                onChange={(e) => setLeadForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Contexto da conversa, interesse, etc."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLead(false)}>Cancelar</Button>
            <Button onClick={handleCreateLead} disabled={creatingLead}>
              {creatingLead ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
