import { cn } from "@/lib/utils";
import {
  BarChart3, Database, Cloud, Download, Building2, Users, Shield,
  CreditCard, Bot, Route, Receipt, MessageSquare, Wrench, ArrowRightLeft,
  ClipboardCheck, ChevronDown, ChevronRight,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export type DevSection =
  | "overview" | "database" | "storage" | "imports"
  | "users" | "subscriptions"
  | "ai" | "ai-router" | "billing" | "cost-monitor"
  | "tickets" | "tools" | "migration" | "setup";

interface NavGroup {
  label: string;
  items: { id: DevSection; label: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { id: "overview", label: "Dashboard", icon: BarChart3 },
    ],
  },
  {
    label: "Infraestrutura",
    items: [
      { id: "database", label: "Banco de Dados", icon: Database },
      { id: "storage", label: "Storage", icon: Cloud },
      { id: "imports", label: "Importações", icon: Download },
    ],
  },
  {
    label: "Gestão",
    items: [
      { id: "users", label: "Usuários & Orgs", icon: Users },
      { id: "subscriptions", label: "Assinaturas", icon: CreditCard },
    ],
  },
  {
    label: "Inteligência Artificial",
    items: [
      { id: "ai", label: "Provedores & Logs", icon: Bot },
      { id: "ai-router", label: "AI Router", icon: Route },
      { id: "billing", label: "Billing IA", icon: Receipt },
      { id: "cost-monitor", label: "Custos por Org", icon: BarChart3 },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "tickets", label: "Tickets", icon: MessageSquare },
      { id: "tools", label: "Ferramentas", icon: Wrench },
      { id: "migration", label: "Migração", icon: ArrowRightLeft },
      { id: "setup", label: "Setup", icon: ClipboardCheck },
    ],
  },
];

// Flat list for mobile select
const allItems = navGroups.flatMap((g) => g.items);

interface DevSidebarProps {
  active: DevSection;
  onSelect: (section: DevSection) => void;
}

export function DevSidebar({ active, onSelect }: DevSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const current = allItems.find((i) => i.id === active);
    return (
      <Select value={active} onValueChange={(v) => onSelect(v as DevSection)}>
        <SelectTrigger className="w-full h-10 text-sm font-medium">
          <SelectValue>
            <span className="flex items-center gap-2">
              {current && <current.icon className="h-4 w-4" />}
              {current?.label ?? "Selecione"}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <nav className="w-56 shrink-0 space-y-1">
      {navGroups.map((group) => (
        <SidebarGroup
          key={group.label}
          group={group}
          active={active}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
}

function SidebarGroup({
  group,
  active,
  onSelect,
}: {
  group: NavGroup;
  active: DevSection;
  onSelect: (s: DevSection) => void;
}) {
  const hasActive = group.items.some((i) => i.id === active);
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
        {group.label}
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {group.items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
