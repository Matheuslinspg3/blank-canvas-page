import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MessageSquare } from "lucide-react";
import { useState, useMemo } from "react";
import { formatDistanceToNow, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatPhone, type BrokerConversation } from "@/hooks/whatsapp/useBrokerChat";

interface Props {
  conversations: BrokerConversation[];
  selectedJid: string | null;
  onSelect: (jid: string) => void;
  isLoading: boolean;
}

type RecencyFilter = "all" | "today" | "yesterday" | "7d" | "30d";

const FILTER_OPTIONS: { value: RecencyFilter; label: string }[] = [
  { value: "all", label: "Todas as mensagens" },
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

type Bucket = "today" | "yesterday" | "last7" | "last30" | "older";

const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "Últimos 7 dias",
  last30: "Últimos 30 dias",
  older: "Mais antigas",
};

const BUCKET_ORDER: Bucket[] = ["today", "yesterday", "last7", "last30", "older"];

function getBucket(date: Date): Bucket {
  if (isToday(date)) return "today";
  if (isYesterday(date)) return "yesterday";
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff <= 7) return "last7";
  if (diff <= 30) return "last30";
  return "older";
}

function passesFilter(bucket: Bucket, filter: RecencyFilter): boolean {
  if (filter === "all") return true;
  if (filter === "today") return bucket === "today";
  if (filter === "yesterday") return bucket === "yesterday";
  if (filter === "7d") return bucket === "today" || bucket === "yesterday" || bucket === "last7";
  if (filter === "30d") return bucket !== "older";
  return true;
}

export function BrokerChatList({ conversations, selectedJid, onSelect, isLoading }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecencyFilter>("all");

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: Record<Bucket, BrokerConversation[]> = {
      today: [],
      yesterday: [],
      last7: [],
      last30: [],
      older: [],
    };

    for (const c of conversations) {
      if (q) {
        const name = (c.contact_name ?? "").toLowerCase();
        if (!c.phone.includes(q) && !name.includes(q) && !c.last_message?.toLowerCase().includes(q)) continue;
      }
      const bucket = getBucket(new Date(c.last_message_at));
      if (!passesFilter(bucket, filter)) continue;
      groups[bucket].push(c);
    }

    return groups;
  }, [conversations, search, filter]);

  const totalVisible = useMemo(
    () => BUCKET_ORDER.reduce((acc, b) => acc + grouped[b].length, 0),
    [grouped]
  );

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as RecencyFilter)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
        ) : totalVisible === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-50" />
            <p className="text-sm">
              {conversations.length === 0
                ? "Nenhuma conversa ainda"
                : "Nada encontrado para este filtro"}
            </p>
            {conversations.length === 0 && (
              <p className="text-xs">Mensagens recebidas no seu número aparecerão aqui.</p>
            )}
          </div>
        ) : (
          <div>
            {BUCKET_ORDER.map((bucket) => {
              const items = grouped[bucket];
              if (items.length === 0) return null;
              return (
                <section key={bucket}>
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/60 px-3 py-1.5 backdrop-blur">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {BUCKET_LABEL[bucket]}
                    </span>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  <ul className="divide-y divide-border">
                    {items.map((c) => {
                      const isActive = c.remote_jid === selectedJid;
                      const displayName = c.contact_name?.trim() || formatPhone(c.phone);
                      const initials = (c.contact_name?.trim() || c.phone)
                        .replace(/[^\p{L}\p{N}]/gu, "")
                        .slice(0, 2)
                        .toUpperCase() || c.phone.slice(-2);
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
                                <p className="truncate text-sm font-medium">
                                  {displayName}
                                </p>
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(c.last_message_at), {
                                    addSuffix: false,
                                    locale: ptBR,
                                  })}
                                </span>
                              </div>
                              {c.contact_name && (
                                <p className="truncate text-[11px] text-muted-foreground/80">
                                  {formatPhone(c.phone)}
                                </p>
                              )}
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
                </section>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
