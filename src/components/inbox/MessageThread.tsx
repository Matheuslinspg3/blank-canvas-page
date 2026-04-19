import { useEffect, useRef } from "react";
import { useConversation } from "@/hooks/omnichannel/useConversation";
import { useConversationMessages } from "@/hooks/omnichannel/useConversationMessages";
import { useMarkConversationRead } from "@/hooks/omnichannel/useMarkConversationRead";
import { useConversationReads } from "@/hooks/omnichannel/useConversationReads";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, PanelRight } from "lucide-react";
import { ConversationComposer } from "./ConversationComposer";
import { AssignmentMenu } from "./AssignmentMenu";
import { StatusMenu } from "./StatusMenu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string | null;
  onToggleRightPanel?: () => void;
  rightPanelOpen?: boolean;
  realtimeConnected?: boolean;
}

const MARK_READ_DEBOUNCE_MS = 800;

export function MessageThread({
  conversationId,
  onToggleRightPanel,
  rightPanelOpen,
  realtimeConnected,
}: Props) {
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [], isLoading } = useConversationMessages(
    conversationId,
    100,
    { realtimeConnected },
  );
  const { data: reads } = useConversationReads();
  const markRead = useMarkConversationRead();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, conversationId]);

  // Mark-as-read seguro:
  // - conversationId estável
  // - mensagens carregadas (não loading, não vazias)
  // - aba visível
  // - debounce 800ms
  // - só dispara se houver inbound mais novo que o last_read_at atual
  // - reavalia em visibilitychange
  const lastMsgTs = messages.length ? messages[messages.length - 1].sent_at : null;
  const lastInboundTs = conversation?.last_inbound_at ?? null;
  const currentReadTs = conversationId ? reads?.get(conversationId) ?? null : null;

  useEffect(() => {
    if (!conversationId || isLoading || messages.length === 0) return;
    if (!lastInboundTs) return;
    if (currentReadTs && new Date(currentReadTs) >= new Date(lastInboundTs)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        markRead.mutate({
          conversationId,
          readAt: lastMsgTs ?? new Date().toISOString(),
        });
      }, MARK_READ_DEBOUNCE_MS);
    };

    schedule();

    const onVis = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // markRead intencionalmente fora das deps (referência estável de mutate basta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isLoading, messages.length, lastInboundTs, currentReadTs, lastMsgTs]);

  if (!conversationId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <MessageSquare className="w-10 h-10 opacity-40" />
        <p className="text-sm">Selecione uma conversa</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm truncate">
            {conversation?.customer_display_name ?? conversation?.external_contact_id ?? "—"}
          </h2>
          <p className="text-[11px] text-muted-foreground truncate">
            {conversation?.channel_type} · {conversation?.status}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {conversation && <AssignmentMenu conversation={conversation} />}
          {conversation && <StatusMenu conversation={conversation} />}
          {onToggleRightPanel && (
            <Button
              variant={rightPanelOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 hidden xl:inline-flex"
              onClick={onToggleRightPanel}
              aria-label="Detalhes do lead"
            >
              <PanelRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">Sem mensagens.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const out = m.direction === "outbound";
              return (
                <li key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      out
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.content_text ?? <span className="italic opacity-70">[{m.content_type}]</span>}
                    {m.media_url && (
                      <a
                        href={m.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block underline text-xs mt-1 opacity-90"
                      >
                        Abrir mídia
                      </a>
                    )}
                    <div className="text-[10px] opacity-60 mt-1 text-right">
                      {format(new Date(m.sent_at), "HH:mm")}
                    </div>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </ScrollArea>

      {conversation && <ConversationComposer conversation={conversation} />}
    </div>
  );
}
