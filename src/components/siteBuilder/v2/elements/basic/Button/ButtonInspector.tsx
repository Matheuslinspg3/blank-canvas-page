import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CommonStylesEditor } from '../../../CommonStylesEditor';
import { useState, useRef, useEffect, useMemo } from 'react';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

// Standard internal link suggestions
const INTERNAL_LINKS = [
  { label: 'Página inicial', href: '/' },
  { label: 'Imóveis', href: '/imoveis' },
  { label: 'Sobre', href: '/sobre' },
  { label: 'Contato', href: '/contato' },
  { label: 'Âncora: Imóveis', href: '#imoveis' },
  { label: 'Âncora: Sobre', href: '#sobre' },
  { label: 'Âncora: Contato', href: '#contato' },
  { label: 'Âncora: Hero', href: '#hero' },
];

function normalizeLink(value: string): string {
  if (!value) return '#';
  if (value.startsWith('/') || value.startsWith('#') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return value;
  }
  return `https://${value}`;
}

export function ButtonInspector({ element, onChange }: Props) {
  const { label, link, variant, size, openInNewTab, fullWidth } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  const [linkFocused, setLinkFocused] = useState(false);
  const [linkValue, setLinkValue] = useState(link || '');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external changes
  useEffect(() => { setLinkValue(link || ''); }, [link]);

  const filteredSuggestions = useMemo(() => {
    if (!linkValue) return INTERNAL_LINKS;
    const q = linkValue.toLowerCase();
    return INTERNAL_LINKS.filter(s => s.label.toLowerCase().includes(q) || s.href.toLowerCase().includes(q));
  }, [linkValue]);

  const commitLink = (val: string) => {
    const normalized = normalizeLink(val);
    setLinkValue(normalized);
    updateProp('link', normalized);
    setLinkFocused(false);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setLinkFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Position fields (for absolute mode)
  const layout = element.layout;
  const isAbsolute = layout?.mode === 'absolute';

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto do botão</Label>
        <Input className="mt-1" value={label || ''} onChange={(e) => updateProp('label', e.target.value)} />
      </div>

      {/* Link picker with suggestions */}
      <div ref={wrapperRef} className="relative">
        <Label className="text-xs">Link</Label>
        <Input
          className="mt-1"
          value={linkValue}
          onChange={(e) => setLinkValue(e.target.value)}
          onFocus={() => setLinkFocused(true)}
          onBlur={() => setTimeout(() => commitLink(linkValue), 200)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLink(linkValue); }}
          placeholder="https://... ou #ancora ou /pagina"
        />
        {linkFocused && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.map((s) => (
              <button
                key={s.href}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex justify-between items-center"
                onMouseDown={(e) => { e.preventDefault(); setLinkValue(s.href); updateProp('link', s.href); setLinkFocused(false); }}
              >
                <span className="text-foreground">{s.label}</span>
                <span className="text-muted-foreground font-mono">{s.href}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">Variante</Label>
        <Select value={variant || 'primary'} onValueChange={(v) => updateProp('variant', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primário</SelectItem>
            <SelectItem value="secondary">Secundário</SelectItem>
            <SelectItem value="outline">Contorno</SelectItem>
            <SelectItem value="ghost">Fantasma</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Tamanho</Label>
        <Select value={size || 'md'} onValueChange={(v) => updateProp('size', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Pequeno</SelectItem>
            <SelectItem value="md">Médio</SelectItem>
            <SelectItem value="lg">Grande</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Largura total</Label>
        <Switch checked={!!fullWidth} onCheckedChange={(v) => updateProp('fullWidth', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Abrir em nova aba</Label>
        <Switch checked={!!openInNewTab} onCheckedChange={(v) => updateProp('openInNewTab', v)} />
      </div>

      {/* Absolute positioning indicator */}
      {isAbsolute && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-semibold">Posicionamento livre</Label>
          <p className="text-[10px] text-muted-foreground">Arraste o botão diretamente no canvas para reposicioná-lo.</p>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <span>X: {layout?.x ?? 0}px</span>
            <span>Y: {layout?.y ?? 0}px</span>
            {layout?.width && <span>L: {layout.width}px</span>}
            {layout?.height && <span>A: {layout.height}px</span>}
          </div>
        </div>
      )}

      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
