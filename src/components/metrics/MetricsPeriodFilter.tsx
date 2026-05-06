import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { MetricsPeriodKey, MetricsDateRange } from "@/hooks/useMetricsData";

interface Props {
  periodKey: MetricsPeriodKey;
  onPeriodChange: (key: MetricsPeriodKey) => void;
  customRange: MetricsDateRange;
  onCustomRangeChange: (range: MetricsDateRange) => void;
  dateRange: MetricsDateRange;
}

const periods: { key: MetricsPeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "last_7_days", label: "Últimos 7 dias" },
  { key: "current_month", label: "Mês atual" },
  { key: "last_month", label: "Mês passado" },
  { key: "custom", label: "Período personalizado" },
];


export function MetricsPeriodFilter({ periodKey, onPeriodChange, customRange, onCustomRangeChange, dateRange }: Props) {
  const [calOpen, setCalOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
      <ToggleGroup
        type="single"
        value={periodKey}
        onValueChange={(v) => v && onPeriodChange(v as MetricsPeriodKey)}
        className="flex flex-wrap gap-1"
      >
        {periods.map((p) => (
          <ToggleGroupItem
            key={p.key}
            value={p.key}
            size="sm"
            className="text-xs px-3 h-8 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground border border-input bg-background"
          >
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {periodKey === "custom" && (
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(dateRange.from, "dd/MM/yy")} – {format(dateRange.to, "dd/MM/yy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: customRange.from, to: customRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onCustomRangeChange({ from: range.from, to: range.to });
                } else if (range?.from) {
                  onCustomRangeChange({ from: range.from, to: range.from });
                }
              }}
              numberOfMonths={2}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
        {format(dateRange.from, "dd MMM yyyy", { locale: ptBR })} — {format(dateRange.to, "dd MMM yyyy", { locale: ptBR })}
      </span>
    </div>
  );
}
