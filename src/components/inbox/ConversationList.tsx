import { useMemo, useState } from "react";
import { useConversations } from "@/hooks/omnichannel/useConversations";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelType, ConversationStatus } from "@/types/omnichannel";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_OPTIONS: { value: ConversationStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertas" },
  { value: "pending", label: "Pendentes" },
  { value: "assigned", label: "Atribuídas" },
  { value: "snoozed", label: "Adiadas" },
  { value: "closed", label: "Fechadas" },
];

const CHANNEL_OPTIONS: { value: ChannelType | "all"; label: string }[] = [
  { value: "all", label: "Todos canais" },
  { value: "whatsapp", label: "WhatsApp" },
];

export function ConversationList({ activeId, onSelect }: Props) {
  const { user } = useAuth();
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [status, setStatus] = useState<ConversationStatus | "all">("all");
  const [channel, setChannel] = useState<ChannelType | "all">("all");
  const [search, setSearch] = useState("");

  const { data: conversations = [], isLoading } = useConversations({
    status: status === "all" ? undefined : status,
    channelType: channel === "all" ? undefined : channel,
    limit: 100,
  });

  const filtered = useMemo(() => {
    let list = conversations;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.customer_display_name ?? "").toLowerCase().includes(q) ||
          (c.last_message_preview ?? "").toLowerCase().includes(q) ||
          c.external_contact_id.toLowerCase().includes(q),
      );
    }
    // "Meus" filtra client-side por owner ativo conhecido na metadata
    // (sem broker_id confiável aqui — fallback simples baseado em metadata.owner_user_id se existir)
    if (scope === "mine" && user?.id) {
      list = list.filter(
        (c) => (c.metadata as any)?.owner_user_id === user.id,
      );
    }
    return list;
  }, [conversations, search, scope, user?.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
            <TabsTrigger value="mine" className="text-xs">Minhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-sm gap-2">
            <MessageSquare className="w-8 h-8 opacity-40" />
            Nenhuma conversa.
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((c) => {
              const isActive = c.id === activeId;
              const initials = (c.customer_display_name ?? c.external_contact_id)
                .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "w-full text-left px-3 py-3 hover:bg-accent transition-colors flex gap-3 items-start",
                      isActive && "bg-accent",
                    )}
                  >
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {c.customer_display_name ?? c.external_contact_id}
                        </span>
                        {c.last_message_at && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.last_message_preview ?? "—"}
                      </p>
                      <div className="flex gap-1 mt-1.5">
                        <Badge variant="outline" className="h-4 text-[9px] px-1">
                          {c.channel_type}
                        </Badge>
                        <Badge
                          variant={c.status === "closed" ? "secondary" : "default"}
                          className="h-4 text-[9px] px-1"
                        >
                          {c.status}
                        </Badge>
                      </div>
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
