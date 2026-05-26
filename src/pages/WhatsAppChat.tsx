import { useState, useEffect, useRef, useMemo } from "react";
import { MessageCircle, Send, Loader2, Bot, Search, FileText, Image as ImageIcon, Mic, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWhatsAppChat } from "@/hooks/useWhatsAppChat";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WhatsAppChat() {
  const {
    conversations,
    selectedJid,
    setSelectedJid,
    selectedMessages,
    sendMessage,
    isSending,
    isLoading,
  } = useWhatsAppChat();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    const txt = draft.trim();
    if (!txt) return;
    sendMessage(txt);
    setDraft("");
  };

  const cleanJid = (jid: string) =>
    jid.replace("@s.whatsapp.net", "").replace("@c.us", "");

  const formatBR = (phone: string) => {
    const p = phone.replace(/\D/g, "");
    if (p.length === 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
    return `+${p}`;
  };

  const formatTime = (ts: string) => {
    try { return format(new Date(ts), "HH:mm", { locale: ptBR }); }
    catch { return ""; }
  };

  const formatListDate = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isToday(d)) return format(d, "HH:mm");
      if (isYesterday(d)) return "Ontem";
      return format(d, "dd/MM/yy");
    } catch { return ""; }
  };

  const formatDateSeparator = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isToday(d)) return "Hoje";
      if (isYesterday(d)) return "Ontem";
      return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch { return ""; }
  };

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) => cleanJid(c.remote_jid).includes(q) || (c.last_message || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  // Group messages by date for separators
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; items: typeof selectedMessages }> = [];
    let currentKey = "";
    selectedMessages.forEach((m) => {
      const key = (m.timestamp || "").slice(0, 10);
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ date: m.timestamp, items: [] });
      }
      groups[groups.length - 1].items.push(m);
    });
    return groups;
  }, [selectedMessages]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedMessages.length, selectedJid]);

  const renderMessageBody = (m: typeof selectedMessages[number]) => {
    const type = (m.message_type || "text").toLowerCase();
    const isImage = type === "image" || type === "imagemessage";
    const isAudio = type === "audio" || type === "audiomessage" || type === "ptt";
    const isDoc = type === "document" || type === "documentmessage";

    if (isImage && m.media_url) {
      return (
        <div className="space-y-1">
          <a href={m.media_url} target="_blank" rel="noopener noreferrer">
            <img
              src={m.media_url}
              alt="imagem"
              className="rounded-md max-h-64 object-cover"
              loading="lazy"
            />
          </a>
          {m.message_text && m.message_text !== "[Imagem recebida]" && (
            <p className="whitespace-pre-wrap break-words text-sm">{m.message_text}</p>
          )}
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="space-y-1 min-w-[220px]">
          {m.media_url ? (
            <audio controls src={m.media_url} className="w-full h-9" preload="none" />
          ) : (
            <div className="flex items-center gap-2 text-xs opacity-70">
              <Mic className="h-3 w-3" /> Áudio
            </div>
          )}
          {m.message_text && (
            <p className="whitespace-pre-wrap break-words text-xs italic opacity-80">
              "{m.message_text}"
            </p>
          )}
        </div>
      );
    }

    if (isDoc) {
      return (
        <a
          href={m.media_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm underline"
        >
          <FileText className="h-4 w-4" />
          {m.message_text || "Documento"}
        </a>
      );
    }

    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        {m.message_text ?? `[${m.message_type}]`}
      </p>
    );
  };

  const previewText = (msg: string | null, type: string) => {
    if (msg && msg.trim()) return msg;
    const t = (type || "").toLowerCase();
    if (t.includes("image")) return "📷 Imagem";
    if (t.includes("audio") || t === "ptt") return "🎤 Áudio";
    if (t.includes("document")) return "📄 Documento";
    return "(sem texto)";
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />

      <PageHeader
        title="Conversas WhatsApp"
        description="Histórico de mensagens trocadas pelo agente de IA e corretores"
      />

      <div className="relative flex-1 p-4 sm:p-6">
        <Card className="grid grid-cols-1 md:grid-cols-[340px_1fr] h-[calc(100vh-180px)] overflow-hidden">
          {/* Conversations list */}
          <div className="border-r border-border/40 flex flex-col bg-card/30">
            <div className="p-3 border-b border-border/40 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Conversas</span>
                <Badge variant="secondary" className="ml-auto">{conversations.length}</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {search ? "Nenhum resultado." : "Nenhuma conversa ainda."}
                </div>
              ) : (
                <ul className="divide-y divide-border/30">
                  {filteredConversations.map((c) => {
                    const phone = cleanJid(c.remote_jid);
                    const initials = phone.slice(-2);
                    const active = selectedJid === c.remote_jid;
                    return (
                      <li key={c.remote_jid}>
                        <button
                          onClick={() => setSelectedJid(c.remote_jid)}
                          className={`w-full text-left p-3 transition-colors hover:bg-muted/40 flex gap-3 items-start ${
                            active ? "bg-muted/60" : ""
                          }`}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-primary/15 text-primary text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {formatBR(phone)}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatListDate(c.last_timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {previewText(c.last_message, "")}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Messages pane */}
          <div className="flex flex-col bg-background/40">
            {!selectedJid ? (
              <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <MessageCircle className="h-10 w-10 opacity-30" />
                Selecione uma conversa à esquerda
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border/40 flex items-center gap-3 bg-card/40">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs">
                      {cleanJid(selectedJid).slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{formatBR(cleanJid(selectedJid))}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {selectedMessages.length} mensagens
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                  <div className="space-y-4">
                    {groupedMessages.map((group, gi) => (
                      <div key={gi} className="space-y-2">
                        <div className="flex justify-center">
                          <span className="text-[10px] uppercase tracking-wide bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                            {formatDateSeparator(group.date)}
                          </span>
                        </div>
                        {group.items.map((m) => {
                          const mine = m.from_me;
                          const isAi = m.sender_type === "ai" || m.sender_type === "agent";
                          return (
                            <div
                              key={m.id}
                              className={`flex ${mine ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                                  mine
                                    ? isAi
                                      ? "bg-primary/15 text-foreground border border-primary/30 rounded-br-sm"
                                      : "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-muted text-foreground rounded-bl-sm"
                                }`}
                              >
                                {mine && isAi && (
                                  <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                                    <Bot className="h-3 w-3" /> IA
                                  </div>
                                )}
                                {renderMessageBody(m)}
                                <div className="text-[10px] opacity-60 mt-1 text-right flex items-center justify-end gap-1">
                                  {formatTime(m.timestamp)}
                                  {mine && <CheckCheck className="h-3 w-3" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-border/40 flex gap-2 bg-card/40">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())
                    }
                    placeholder="Digite uma mensagem..."
                    disabled={isSending}
                  />
                  <Button onClick={handleSend} disabled={isSending || !draft.trim()} size="icon">
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
