import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction, MessageSquare, Bot, AlertTriangle } from "lucide-react";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import type { DevSection } from "./DevSidebar";

interface Props {
  onNavigate: (section: DevSection) => void;
}

export function DevOverviewCards({ onNavigate }: Props) {
  const { isMaintenanceMode } = useMaintenanceMode();

  const { data: ticketCount } = useQuery({
    queryKey: ["dev-ticket-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const { data: aiErrors } = useQuery({
    queryKey: ["dev-ai-errors-24h"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("ai_router_logs")
        .select("id", { count: "exact", head: true })
        .eq("success", false)
        .gte("created_at", since);
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const cards = [
    {
      label: "Manutenção",
      value: isMaintenanceMode ? "ATIVA" : "Inativa",
      icon: Construction,
      variant: isMaintenanceMode ? "destructive" as const : "secondary" as const,
      section: "tools" as DevSection,
    },
    {
      label: "Tickets Abertos",
      value: String(ticketCount ?? 0),
      icon: MessageSquare,
      variant: (ticketCount && ticketCount > 0) ? "default" as const : "secondary" as const,
      section: "tickets" as DevSection,
    },
    {
      label: "Erros IA (24h)",
      value: String(aiErrors ?? 0),
      icon: aiErrors && aiErrors > 0 ? AlertTriangle : Bot,
      variant: (aiErrors && aiErrors > 0) ? "destructive" as const : "secondary" as const,
      section: "ai" as DevSection,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => onNavigate(card.section)}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
              <card.icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold tabular-nums">{card.value}</span>
                <Badge variant={card.variant} className="text-[10px] h-5">
                  {card.variant === "destructive" ? "Atenção" : "OK"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
