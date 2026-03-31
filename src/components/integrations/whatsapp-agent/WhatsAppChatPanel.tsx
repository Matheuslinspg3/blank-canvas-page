import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageCircle, Send, ArrowLeft, User, Plus } from "lucide-react";
import { useWhatsAppChat } from "@/hooks/useWhatsAppChat";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  const [draft, setDraft] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    // Select the new conversation
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
                  <span className="font-medium text-sm">{formatJid(selectedJid)}</span>
                </div>

                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="space-y-2">
                    {selectedMessages.map((msg) => (
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
                          <p className="whitespace-pre-wrap break-words">{msg.message_text}</p>
                          <p
                            className={cn(
                              "text-[10px] mt-1",
                              msg.from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}
                          >
                            {format(new Date(msg.timestamp), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="px-4 py-3 border-t border-border flex gap-2">
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
    </>
  );
}
