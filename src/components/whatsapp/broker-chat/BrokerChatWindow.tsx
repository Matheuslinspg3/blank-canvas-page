import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, UserPlus, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  formatPhone,
  jidToPhone,
  useBrokerMessages,
  useBrokerContactLead,
} from "@/hooks/whatsapp/useBrokerChat";
import { useLeadCRUD } from "@/hooks/useLeadCRUD";
import { useLeadStages } from "@/hooks/useLeadStages";
import { useAuth } from "@/contexts/AuthContext";
import { BrokerChatComposer } from "./BrokerChatComposer";

interface Props {
  remoteJid: string | null;
  contactName?: string | null;
}

export function BrokerChatWindow({ remoteJid, contactName }: Props) {
  const { data: messages, isLoading } = useBrokerMessages(remoteJid);
  const phone = remoteJid ? jidToPhone(remoteJid) : null;
  const { data: existingLead, isLoading: isLoadingLead } = useBrokerContactLead(phone);
  const { user } = useAuth();
  const { leadStages } = useLeadStages();
  const { createLead } = useLeadCRUD({
    leadStages,
    isBrokerOnly: false,
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCreateLead = () => {
    if (!phone || !user) return;
    createLead.mutate({
      name: contactName?.trim() || `WhatsApp ${formatPhone(phone)}`,
      phone: phone.replace(/\D/g, ""),
      source: "WhatsApp Broker",
      broker_id: user.id,
      notes: `Lead criado via Chat do Corretor (WhatsApp).`,
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!remoteJid) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Selecione uma conversa para começar a responder.
        </p>
      </div>
    );
  }

  const cleanPhone = phone || "";
  const displayName = contactName?.trim() || formatPhone(cleanPhone);
  const initials = cleanPhone.slice(-2);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {contactName?.trim() ? formatPhone(phone || "") : "Canal pessoal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLoadingLead && (
            existingLead ? (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" disabled>
                <CheckCircle2 className="h-3.5 w-3.5" />
                No CRM
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-1.5 text-xs"
                onClick={handleCreateLead}
                disabled={createLead.isPending}
              >
                {createLead.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                Enviar ao CRM
              </Button>
            )
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/10 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {(messages ?? []).map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex max-w-[75%] flex-col gap-0.5 rounded-lg px-3 py-2 text-sm shadow-sm",
                  m.from_me
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-card text-card-foreground"
                )}
              >
                {m.message_type === "image" && m.media_url && (
                  <img
                    src={m.media_url}
                    alt="anexo"
                    className="mb-1 max-h-64 rounded object-cover"
                  />
                )}
                {m.message_type === "audio" && m.media_url && (
                  <audio src={m.media_url} controls className="mb-1" />
                )}
                {m.message_type === "document" && m.media_url && (
                  <a
                    href={m.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1 underline opacity-90"
                  >
                    📄 Abrir documento
                  </a>
                )}
                {m.message_text && <span className="whitespace-pre-wrap break-words">{m.message_text}</span>}
                <span
                  className={cn(
                    "self-end text-[10px] opacity-70",
                    m.from_me ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {format(new Date(m.timestamp), "HH:mm")}
                  {m.sender_type === "ai" && " · IA"}
                </span>
              </li>
            ))}
            {(messages ?? []).length === 0 && (
              <li className="self-center py-8 text-sm text-muted-foreground">
                Nenhuma mensagem ainda
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Composer */}
      <BrokerChatComposer phone={phone} />
    </div>
  );
}
