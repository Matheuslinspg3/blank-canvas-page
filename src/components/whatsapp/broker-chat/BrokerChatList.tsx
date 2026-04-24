import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, MessageSquare } from "lucide-react";
import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatPhone, type BrokerConversation } from "@/hooks/whatsapp/useBrokerChat";

interface Props {
  conversations: BrokerConversation[];
  selectedJid: string | null;
  onSelect: (jid: string) => void;
  isLoading: boolean;
}

export function BrokerChatList({ conversations, selectedJid, onSelect, isLoading }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      (c) => c.phone.includes(q) || c.last_message?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-50" />
            <p className="text-sm">Nenhuma conversa ainda</p>
            <p className="text-xs">Mensagens recebidas no seu número aparecerão aqui.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => {
              const isActive = c.remote_jid === selectedJid;
              const initials = c.phone.slice(-2);
              return (
                <li key={c.remote_jid}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.remote_jid)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                      isActive && "bg-muted"
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{formatPhone(c.phone)}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.last_message_at), {
                            addSuffix: false,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.last_from_me ? "Você: " : ""}
                        {c.last_message || "—"}
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
  );
}
