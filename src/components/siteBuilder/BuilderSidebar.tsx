import { useCallback, useMemo } from 'react';
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BlockRegistry } from '@/components/siteBuilder/blockRegistry';
import type { Block, BlockType, BlockVariant } from '@/types/siteBuilder';
import type { SiteBuilderAction } from '@/hooks/useSiteBuilderState';

// ── Sortable item ────────────────────────────────────────────
function SortableBlock({
  block,
  isSelected,
  onSelect,
  onToggle,
  onDelete,
}: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const def = BlockRegistry[block.type]?.[block.variant];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted'
      }`}
      onClick={onSelect}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </button>
      {def?.icon && (() => { const Icon = def.icon; return <Icon />; })()}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{def?.label || block.type}</p>
        <p className="text-xs text-muted-foreground">Var {block.variant}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="text-muted-foreground hover:text-foreground"
      >
        {block.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Excluir este bloco?')) onDelete();
        }}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Block gallery ────────────────────────────────────────────
function BlockGallery({ onAdd }: { onAdd: (type: BlockType, variant: BlockVariant) => void }) {
  const entries = useMemo(() => {
    const list: { type: BlockType; variant: BlockVariant; label: string; Icon: any }[] = [];
    for (const [type, variants] of Object.entries(BlockRegistry)) {
      for (const [variant, def] of Object.entries(variants)) {
        if (!def) continue;
        list.push({ type: type as BlockType, variant: variant as BlockVariant, label: def.label, Icon: def.icon });
      }
    }
    return list;
  }, []);

  return (
    <div className="grid grid-cols-1 gap-2 p-4">
      {entries.map((e) => (
        <button
          key={`${e.type}-${e.variant}`}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
          onClick={() => onAdd(e.type, e.variant)}
        >
          {e.Icon && <e.Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
          <span className="text-sm">{e.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main Sidebar ─────────────────────────────────────────────
interface Props {
  blocks: Block[];
  selectedBlockId: string | null;
  dispatch: React.Dispatch<SiteBuilderAction>;
}

export function BuilderSidebar({ blocks, selectedBlockId, dispatch }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const sorted = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);
  const ids = useMemo(() => sorted.map((b) => b.id), [sorted]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      const newOrder = [...ids];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      dispatch({ type: 'REORDER_BLOCKS', order: newOrder });
    },
    [ids, dispatch]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">Seções da Página</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {sorted.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isSelected={block.id === selectedBlockId}
                  onSelect={() => dispatch({ type: 'SELECT_BLOCK', id: block.id })}
                  onToggle={() => dispatch({ type: 'TOGGLE_VISIBILITY', id: block.id })}
                  onDelete={() => dispatch({ type: 'DELETE_BLOCK', id: block.id })}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>
      <div className="p-3 border-t">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full" size="sm">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Bloco
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Blocos Disponíveis</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-80px)]">
              <BlockGallery onAdd={(type, variant) => dispatch({ type: 'ADD_BLOCK', blockType: type, variant })} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
