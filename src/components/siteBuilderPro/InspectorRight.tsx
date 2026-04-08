import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ElementRegistry } from '@/components/siteBuilder/v2/elementRegistry';
import type { BuilderState, BuilderAction } from '@/hooks/useSiteBuilderProState';
import type { Section, Column } from '@/types/siteBuilderV2';

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
}

const FONTS = ['Inter', 'Montserrat', 'Playfair Display', 'Poppins', 'Lora', 'Outfit', 'Sora'];
const ROW_CONFIGS: { label: string; config: number[] }[] = [
  { label: '1 coluna (12)', config: [12] },
  { label: '2 colunas (6+6)', config: [6, 6] },
  { label: '3 colunas (4+4+4)', config: [4, 4, 4] },
  { label: '4 colunas (3+3+3+3)', config: [3, 3, 3, 3] },
  { label: '2 colunas (8+4)', config: [8, 4] },
  { label: '2 colunas (4+8)', config: [4, 8] },
];

export function InspectorRight({ state, dispatch }: Props) {
  const { selection } = state;

  return (
    <div className="h-full flex flex-col bg-background border-l">
      <div className="px-3 py-2 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {selection.type === 'none' && 'Configurações'}
          {selection.type === 'section' && 'Seção'}
          {selection.type === 'column' && 'Coluna'}
          {selection.type === 'element' && 'Elemento'}
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {selection.type === 'none' && <GlobalInspector state={state} dispatch={dispatch} />}
          {selection.type === 'section' && <SectionInspector state={state} dispatch={dispatch} />}
          {selection.type === 'column' && <ColumnInspector state={state} dispatch={dispatch} />}
          {selection.type === 'element' && <ElementInspector state={state} dispatch={dispatch} />}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Global ───────────────────────────────────────────────────
function GlobalInspector({ state, dispatch }: Props) {
  const { theme, meta } = state.present;
  return (
    <Tabs defaultValue="theme">
      <TabsList className="w-full h-8">
        <TabsTrigger value="theme" className="text-xs flex-1">Tema</TabsTrigger>
        <TabsTrigger value="seo" className="text-xs flex-1">SEO</TabsTrigger>
      </TabsList>
      <TabsContent value="theme" className="space-y-3 mt-3">
        <ColorField label="Cor primária" value={theme.primaryColor} onChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { primaryColor: v } })} />
        <ColorField label="Cor secundária" value={theme.secondaryColor} onChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { secondaryColor: v } })} />
        <ColorField label="Cor de destaque" value={theme.accentColor} onChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { accentColor: v } })} />
        <div>
          <Label className="text-xs">Fonte</Label>
          <Select value={theme.fontFamily} onValueChange={(v) => dispatch({ type: 'UPDATE_THEME', theme: { fontFamily: v } })}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONTS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>
      <TabsContent value="seo" className="space-y-3 mt-3">
        <div>
          <Label className="text-xs">Título do site</Label>
          <Input className="h-8 text-xs mt-1" value={meta.title} onChange={(e) => dispatch({ type: 'UPDATE_META', meta: { title: e.target.value } })} />
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Textarea className="text-xs mt-1 min-h-[80px]" value={meta.description} onChange={(e) => dispatch({ type: 'UPDATE_META', meta: { description: e.target.value } })} />
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Section ──────────────────────────────────────────────────
function SectionInspector({ state, dispatch }: Props) {
  const section = state.present.sections.find(s => s.id === (state.selection as any).sectionId);
  if (!section) return <p className="text-xs text-muted-foreground">Seção não encontrada</p>;
  const sid = section.id;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome</Label>
        <Input className="h-8 text-xs mt-1" value={section.name || ''} onChange={(e) => dispatch({ type: 'UPDATE_SECTION_NAME', sectionId: sid, name: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Padding top ({section.styles.paddingTop ?? 0}px)</Label>
        <Slider className="mt-1" min={0} max={200} step={4} value={[section.styles.paddingTop ?? 0]} onValueChange={([v]) => dispatch({ type: 'UPDATE_SECTION_STYLES', sectionId: sid, styles: { paddingTop: v } })} />
      </div>
      <div>
        <Label className="text-xs">Padding bottom ({section.styles.paddingBottom ?? 0}px)</Label>
        <Slider className="mt-1" min={0} max={200} step={4} value={[section.styles.paddingBottom ?? 0]} onValueChange={([v]) => dispatch({ type: 'UPDATE_SECTION_STYLES', sectionId: sid, styles: { paddingBottom: v } })} />
      </div>
      <ColorField label="Cor de fundo" value={section.styles.bgColor || '#ffffff'} onChange={(v) => dispatch({ type: 'UPDATE_SECTION_STYLES', sectionId: sid, styles: { bgColor: v } })} />
      <div>
        <Label className="text-xs">Imagem de fundo (URL)</Label>
        <Input className="h-8 text-xs mt-1" value={section.styles.bgImage || ''} onChange={(e) => dispatch({ type: 'UPDATE_SECTION_STYLES', sectionId: sid, styles: { bgImage: e.target.value } })} placeholder="https://..." />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Largura total</Label>
        <Switch checked={!!section.styles.fullWidth} onCheckedChange={(v) => dispatch({ type: 'UPDATE_SECTION_STYLES', sectionId: sid, styles: { fullWidth: v } })} />
      </div>
      <div>
        <Label className="text-xs">Altura mínima (px)</Label>
        <Input type="number" className="h-8 text-xs mt-1" value={section.styles.minHeight ?? ''} onChange={(e) => dispatch({ type: 'UPDATE_SECTION_STYLES', sectionId: sid, styles: { minHeight: Number(e.target.value) || 0 } })} />
      </div>

      <div className="border-t pt-3">
        <Label className="text-xs font-semibold">Adicionar Linha</Label>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {ROW_CONFIGS.map(rc => (
            <Button key={rc.label} variant="outline" size="sm" className="text-[10px] h-7" onClick={() => dispatch({ type: 'ADD_ROW', sectionId: sid, columnsConfig: rc.config })}>
              {rc.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────
function ColumnInspector({ state, dispatch }: Props) {
  const sel = state.selection as { type: 'column'; sectionId: string; rowId: string; columnId: string };
  let column: Column | undefined;
  for (const s of state.present.sections) {
    if (s.id !== sel.sectionId) continue;
    for (const r of s.rows) {
      if (r.id !== sel.rowId) continue;
      column = r.columns.find(c => c.id === sel.columnId);
    }
  }
  if (!column) return <p className="text-xs text-muted-foreground">Coluna não encontrada</p>;

  const update = (styles: Partial<Column['styles']>) => dispatch({ type: 'UPDATE_COLUMN_STYLES', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, styles });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Largura ({column.width}/12)</Label>
        <Slider className="mt-1" min={1} max={12} step={1} value={[column.width]} onValueChange={([v]) => {}} />
      </div>
      <ColorField label="Cor de fundo" value={column.styles.bgColor || ''} onChange={(v) => update({ bgColor: v })} />
      <div>
        <Label className="text-xs">Alinhamento vertical</Label>
        <Select value={column.styles.verticalAlign || 'top'} onValueChange={(v) => update({ verticalAlign: v as any })}>
          <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Topo</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="bottom">Base</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumField label="Pad. T" value={column.styles.paddingTop ?? 0} onChange={(v) => update({ paddingTop: v })} />
        <NumField label="Pad. R" value={column.styles.paddingRight ?? 0} onChange={(v) => update({ paddingRight: v })} />
        <NumField label="Pad. B" value={column.styles.paddingBottom ?? 0} onChange={(v) => update({ paddingBottom: v })} />
        <NumField label="Pad. L" value={column.styles.paddingLeft ?? 0} onChange={(v) => update({ paddingLeft: v })} />
      </div>
    </div>
  );
}

// ── Element ──────────────────────────────────────────────────
function ElementInspector({ state, dispatch }: Props) {
  const sel = state.selection as { type: 'element'; sectionId: string; rowId: string; columnId: string; elementId: string };
  let element: any;
  for (const s of state.present.sections) {
    if (s.id !== sel.sectionId) continue;
    for (const r of s.rows) {
      if (r.id !== sel.rowId) continue;
      for (const c of r.columns) {
        if (c.id !== sel.columnId) continue;
        element = c.elements.find(e => e.id === sel.elementId);
      }
    }
  }
  if (!element) return <p className="text-xs text-muted-foreground">Elemento não encontrado</p>;

  const def = ElementRegistry[element.type as keyof typeof ElementRegistry];
  if (!def) return <p className="text-xs text-muted-foreground">Tipo desconhecido: {element.type}</p>;

  const Icon = def.icon;
  const Inspector = def.Inspector;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{def.label}</span>
      </div>
      <Inspector
        element={element}
        onChange={(props, styles) => {
          if (props) dispatch({ type: 'UPDATE_ELEMENT_PROPS', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementId: sel.elementId, props });
          if (styles) dispatch({ type: 'UPDATE_ELEMENT_STYLES', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementId: sel.elementId, styles });
        }}
      />
    </div>
  );
}

// ── Shared fields ────────────────────────────────────────────
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 mt-1">
        <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
        <Input className="h-8 text-xs flex-1" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-[10px] w-8 shrink-0">{label}</Label>
      <Input type="number" className="h-7 text-xs" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
