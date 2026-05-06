import { Search, UserPlus, Users, PhoneOff, UserCheck, UserMinus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useBrokers } from "@/hooks/useBrokers";
import type { MetricsFilters } from "@/hooks/useMetricsData";

interface Props {
  filters: MetricsFilters;
  onFiltersChange: (filters: MetricsFilters) => void;
}

export function MetricsAdvancedFilters({ filters, onFiltersChange }: Props) {
  const { brokers } = useBrokers();

  return (
    <div className="flex flex-wrap items-center gap-6 p-4 bg-card rounded-lg border border-border shadow-sm">
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <Label className="text-xs font-medium flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          Corretor responsável
        </Label>
        <Select
          value={filters.brokerId || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, brokerId: v })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Selecione o corretor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os corretores</SelectItem>
            <SelectItem value="none">Leads sem corretor</SelectItem>
            {brokers.map((b) => (
              <SelectItem key={b.user_id} value={b.user_id}>
                {b.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 min-w-[150px]">
        <Label className="text-xs font-medium flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Status do Lead
        </Label>
        <Select
          value={filters.leadStatus || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, leadStatus: v as any })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os leads</SelectItem>
            <SelectItem value="active">Leads ativos</SelectItem>
            <SelectItem value="inactive">Leads inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 bg-muted/30 px-3 py-2 rounded-md border border-border/50">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="deduplicate" className="text-xs font-medium flex items-center gap-2 cursor-pointer">
            <PhoneOff className="h-3.5 w-3.5 text-muted-foreground" />
            Deduplicação por Telefone
          </Label>
          <p className="text-[10px] text-muted-foreground">Agrupar leads com mesmo número</p>
        </div>
        <Switch
          id="deduplicate"
          checked={filters.deduplicate}
          onCheckedChange={(v) => onFiltersChange({ ...filters, deduplicate: v })}
        />
      </div>
    </div>
  );
}
