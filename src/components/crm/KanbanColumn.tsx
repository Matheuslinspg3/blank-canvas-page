import { memo, useCallback, useMemo, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { LeadCard } from './LeadCard';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Lead } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';

const ESTIMATED_CARD_HEIGHT = 120;
const OVERSCAN = 5;

function KanbanColumnContent({ leads, onLeadClick }: { leads: Lead[]; onLeadClick: (lead: Lead) => void }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);

  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: OVERSCAN,
  });

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Users className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">Nenhum lead nesta etapa</p>
      </div>
    );
  }

  return (
    <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
      <div
        ref={parentRef}
        className="h-full max-h-[calc(100vh-320px)] overflow-y-auto"
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const lead = leads[virtualItem.index];
            return (
              <div
                key={lead.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full pb-2 pr-2"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <LeadCard lead={lead} onClick={() => onLeadClick(lead)} />
              </div>
            );
          })}
        </div>
      </div>
    </SortableContext>
  );
}

interface KanbanColumnProps {
  stage: LeadStage;
  leads: Lead[];
  stats: {
    count: number;
    totalValue: number;
  };
  onLeadClick: (lead: Lead) => void;
}

function formatCurrency(value: number) {
  if (value === 0) return 'R$ 0';
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

function KanbanColumnComponent({ stage, leads, stats, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const handleLeadClick = useCallback((lead: Lead) => {
    onLeadClick(lead);
  }, [onLeadClick]);

  return (
    <div className="flex-shrink-0 w-72 lg:w-80">
      <Card className={`bg-muted/30 transition-colors h-full flex flex-col ${isOver ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className="py-3 px-3 lg:px-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              <CardTitle className="text-sm font-medium truncate">{stage.name}</CardTitle>
              <Badge variant="secondary" className="text-xs shrink-0">
                {stats.count}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(stats.totalValue)}
          </p>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className="px-2 pb-2 flex-1 min-h-[200px]"
        >
          <KanbanColumnContent leads={leads} onLeadClick={handleLeadClick} />
        </CardContent>
      </Card>
    </div>
  );
}

export const KanbanColumn = memo(KanbanColumnComponent);
