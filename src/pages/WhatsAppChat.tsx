import { useState } from "react";
import { MessageCircle, Send, Loader2, User, Bot } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppChat } from "@/hooks/useWhatsAppChat";
import { format } from "date-fns";
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

  const handleSend = () => {
    const txt = draft.trim();
    if (!txt) return;
    sendMessage(txt);
    setDraft("");
  };

  const formatTime = (ts: string) => {
    try { return format(new Date(ts), "dd/MM HH:mm", { locale: ptBR }); }
    catch { return ""; }
  };

  const cleanJid = (jid: string) =>
    jid.replace("@s.whatsapp.net", "").replace("@c.us", "");

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />

      <PageHeader
        title="Conversas WhatsApp"
        description="Histórico de mensagens trocadas pelo agente de IA e corretores"
      />

      <div className="relative flex-1 p-4 sm:p-6">
        <Card className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-180px)] overflow-hidden">
          {/* Conversations list */}
          <div className="border-r border-border/40 flex flex-col">
            <div className="p-3 border-b border-border/40 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Conversas</span>
              <Badge variant="secondary" className="ml-auto">{conversations.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda.
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {conversations.map((c) => (
                    <li key={c.remote_jid}>
                      <button
                        onClick={() => setSelectedJid(c.remote_jid)}
                        className={`w-full text-left p-3 transition-colors hover:bg-muted/40 ${
                          selectedJid === c.remote_jid ? "bg-muted/60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            +{cleanJid(c.remote_jid)}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTime(c.last_timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {c.last_message ?? "(sem texto)"}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Messages pane */}
          <div className="flex flex-col">
            {!selectedJid ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Selecione uma conversa à esquerda
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border/40 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-semibold">+{cleanJid(selectedJid)}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {selectedMessages.length} mensagens
                  </Badge>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-2">
                    {selectedMessages.map((m) => {
                      const mine = m.from_me;
                      const isAi = m.sender_type === "ai" || m.sender_type === "agent";
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              mine
                                ? isAi
                                  ? "bg-primary/15 text-foreground border border-primary/30"
                                  : "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            {mine && isAi && (
                              <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                                <Bot className="h-3 w-3" /> IA
                              </div>
                            )}
                            <p className="whitespace-pre-wrap break-words">
                              {m.message_text ?? `[${m.message_type}]`}
                            </p>
                            {m.media_url && (
                              <a
                                href={m.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-1 text-[10px] underline opacity-80"
                              >
                                Ver mídia
                              </a>
                            )}
                            <div className="text-[10px] opacity-60 mt-1 text-right">
                              {formatTime(m.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t border-border/40 flex gap-2">
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
