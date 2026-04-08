import { useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BlockRegistry } from '@/components/siteBuilder/blockRegistry';
import type { Block, SiteTheme, SiteMeta, BlockVariant } from '@/types/siteBuilder';
import type { SiteBuilderAction } from '@/hooks/useSiteBuilderState';

const FONT_OPTIONS = ['Inter', 'Montserrat', 'Playfair Display', 'Poppins', 'Lora', 'Outfit', 'Sora'];

// ── Color field ──────────────────────────────────────────────
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-8 text-xs" />
      </div>
    </div>
  );
}

// ── Global settings (no block selected) ──────────────────────
function GlobalInspector({
  theme,
  meta,
  dispatch,
}: {
  theme: SiteTheme;
  meta: SiteMeta;
  dispatch: React.Dispatch<SiteBuilderAction>;
}) {
  return (
    <Tabs defaultValue="theme" className="h-full flex flex-col">
      <TabsList className="grid grid-cols-2 mx-4 mt-3">
        <TabsTrigger value="theme">Tema</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
      </TabsList>
      <TabsContent value="theme" className="flex-1 overflow-auto">
        <div className="space-y-4 p-4">
          <ColorField label="Cor primária" value={theme.primaryColor} onChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { primaryColor: v } })} />
          <ColorField label="Cor secundária" value={theme.secondaryColor} onChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { secondaryColor: v } })} />
          <ColorField label="Cor de destaque" value={theme.accentColor} onChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { accentColor: v } })} />
          <div className="space-y-1">
            <Label className="text-xs">Fonte</Label>
            <Select value={theme.fontFamily} onValueChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { fontFamily: v } })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="seo" className="flex-1 overflow-auto">
        <div className="space-y-4 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Título da página</Label>
            <Input value={meta.title} onChange={(e) => dispatch({ type: 'UPDATE_META', meta: { title: e.target.value } })} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição (meta)</Label>
            <Textarea value={meta.description} onChange={(e) => dispatch({ type: 'UPDATE_META', meta: { description: e.target.value } })} rows={4} className="text-xs" />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Block inspector ──────────────────────────────────────────
function BlockInspector({
  block,
  dispatch,
}: {
  block: Block;
  dispatch: React.Dispatch<SiteBuilderAction>;
}) {
  const def = BlockRegistry[block.type]?.[block.variant];
  const availableVariants = useMemo(() => {
    const variants: { key: BlockVariant; label: string }[] = [];
    const typeEntry = BlockRegistry[block.type];
    for (const [v, d] of Object.entries(typeEntry)) {
      if (d) variants.push({ key: v as BlockVariant, label: d.label });
    }
    return variants;
  }, [block.type]);

  const handlePropsChange = useCallback(
    (props: any) => dispatch({ type: 'UPDATE_BLOCK_PROPS', id: block.id, props }),
    [block.id, dispatch]
  );

  if (!def) return <p className="p-4 text-sm text-muted-foreground">Bloco não encontrado no registry.</p>;

  const InspectorComponent = def.Inspector as any;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {def.icon && <def.icon className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">{block.type}</span>
          <span className="text-xs text-muted-foreground">Var {block.variant}</span>
        </div>
      </div>

      {availableVariants.length > 1 && (
        <div className="px-4 py-2 border-b">
          <Label className="text-xs">Variante do Layout</Label>
          <Select
            value={block.variant}
            onValueChange={(v) => dispatch({ type: 'CHANGE_VARIANT', id: block.id, variant: v as BlockVariant })}
          >
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableVariants.map((av) => (
                <SelectItem key={av.key} value={av.key}>{av.key} — {av.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <InspectorComponent block={block} onChange={handlePropsChange} />
      </div>
    </div>
  );
}

// ── Main Inspector ───────────────────────────────────────────
interface Props {
  blocks: Block[];
  selectedBlockId: string | null;
  theme: SiteTheme;
  meta: SiteMeta;
  dispatch: React.Dispatch<SiteBuilderAction>;
}

export function BuilderInspector({ blocks, selectedBlockId, theme, meta, dispatch }: Props) {
  const selectedBlock = useMemo(
    () => (selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) || null : null),
    [blocks, selectedBlockId]
  );

  return (
    <div className="h-full flex flex-col border-l bg-background">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">
          {selectedBlock ? 'Propriedades do Bloco' : 'Configurações Globais'}
        </h2>
      </div>
      <ScrollArea className="flex-1">
        {selectedBlock ? (
          <BlockInspector block={selectedBlock} dispatch={dispatch} />
        ) : (
          <GlobalInspector theme={theme} meta={meta} dispatch={dispatch} />
        )}
      </ScrollArea>
    </div>
  );
}
