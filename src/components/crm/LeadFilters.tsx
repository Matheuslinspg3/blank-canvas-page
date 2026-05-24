import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import type { Broker } from '@/hooks/useBrokers';
import { LeadStageManager } from './LeadStageManager';
import { LEAD_SOURCES, TEMPERATURES } from '@/hooks/useLeads';
import { useUserRoles } from '@/hooks/useUserRole';

interface LeadFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedBrokerId: string | null;
  onBrokerChange: (value: string | null) => void;
  brokers: Broker[];
  selectedSource: string | null;
  onSourceChange: (value: string | null) => void;
  selectedTemperature: string | null;
  onTemperatureChange: (value: string | null) => void;
  selectedConversion: string | null;
  onConversionChange: (value: string | null) => void;
  conversionOptions: string[];
  stalenessFilter: string | null;
  onStalenessChange: (value: string | null) => void;
  criteriaFilter: string | null;
  onCriteriaChange: (value: string | null) => void;
}


export function LeadFilters({
  search,
  onSearchChange,
  selectedBrokerId,
  onBrokerChange,
  brokers,
  selectedSource,
  onSourceChange,
  selectedTemperature,
  onTemperatureChange,
  selectedConversion,
  onConversionChange,
  conversionOptions,
  stalenessFilter,
  onStalenessChange,
  criteriaFilter,
  onCriteriaChange,
}: LeadFiltersProps) {

  const [filtersOpen, setFiltersOpen] = useState(false);
  const { isAdminOrAbove } = useUserRoles();
  const canManageTypes = isAdminOrAbove;
  const hasAdvancedFilters = !!selectedBrokerId || !!selectedSource || !!selectedTemperature || !!selectedConversion || !!stalenessFilter || !!criteriaFilter;

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-10"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {canManageTypes && <LeadStageManager />}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant={hasAdvancedFilters ? 'default' : 'outline'} size="icon" className="shrink-0">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
      <CollapsibleContent>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Select
              value={selectedBrokerId || 'all'}
              onValueChange={(value) => onBrokerChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os corretores</SelectItem>
                {brokers.map((broker) => (
                  <SelectItem key={broker.user_id} value={broker.user_id}>
                    {broker.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedSource || 'all'}
              onValueChange={(value) => onSourceChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedTemperature || 'all'}
              onValueChange={(value) => onTemperatureChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas temperaturas</SelectItem>
                {TEMPERATURES.map((temp) => (
                  <SelectItem key={temp.id} value={temp.id}>
                    <span className={`mr-1 ${temp.color}`}>●</span>
                    {temp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {conversionOptions.length > 0 && (
              <Select
                value={selectedConversion || 'all'}
                onValueChange={(value) => onConversionChange(value === 'all' ? null : value)}
              >
                <SelectTrigger className="flex-1 sm:w-[200px]">
                  <SelectValue placeholder="Anúncio de origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anúncios</SelectItem>
                  {conversionOptions.map((ci) => (
                    <SelectItem key={ci} value={ci}>
                      {ci}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={stalenessFilter || 'all'}
              onValueChange={(value) => onStalenessChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Inatividade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer tempo</SelectItem>
                <SelectItem value="stale">Parado (7+ dias)</SelectItem>
                <SelectItem value="critical">Crítico (14+ dias)</SelectItem>
                <SelectItem value="recent">Recente (&lt; 7 dias)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={criteriaFilter || 'all'}
              onValueChange={(value) => onCriteriaChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="flex-1 sm:w-[160px]">
                <SelectValue placeholder="Dados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Com/Sem critérios</SelectItem>
                <SelectItem value="has_criteria">Com critérios</SelectItem>
                <SelectItem value="no_criteria">Sem critérios</SelectItem>
              </SelectContent>
            </Select>

            {hasAdvancedFilters && (

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onBrokerChange(null);
                  onSourceChange(null);
                  onTemperatureChange(null);
                  onConversionChange(null);
                  onStalenessChange(null);
                  onCriteriaChange(null);
                }}

                className="text-xs"
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
