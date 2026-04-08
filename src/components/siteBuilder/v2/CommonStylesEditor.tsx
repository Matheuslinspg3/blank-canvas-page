import type { ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Props {
  styles: ElementStyles;
  onChange: (styles: ElementStyles) => void;
}

export function CommonStylesEditor({ styles, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const update = (key: keyof ElementStyles, value: any) => {
    onChange({ ...styles, [key]: value });
  };

  const numField = (label: string, key: keyof ElementStyles) => (
    <div className="flex items-center gap-2">
      <Label className="text-xs w-8 shrink-0">{label}</Label>
      <Input
        type="number"
        className="h-7 text-xs"
        value={styles[key] as number ?? 0}
        onChange={(e) => update(key, Number(e.target.value))}
      />
    </div>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-2 mt-3">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        Estilos avançados
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        {/* Padding */}
        <div>
          <p className="text-xs font-medium mb-1">Padding (px)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {numField('T', 'paddingTop')}
            {numField('R', 'paddingRight')}
            {numField('B', 'paddingBottom')}
            {numField('L', 'paddingLeft')}
          </div>
        </div>

        {/* Margin */}
        <div>
          <p className="text-xs font-medium mb-1">Margem (px)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {numField('T', 'marginTop')}
            {numField('B', 'marginBottom')}
          </div>
        </div>

        {/* Background */}
        <div>
          <Label className="text-xs">Cor de fundo</Label>
          <div className="flex gap-2 mt-1">
            <input
              type="color"
              value={styles.bgColor || '#ffffff'}
              onChange={(e) => update('bgColor', e.target.value)}
              className="w-8 h-7 rounded border cursor-pointer"
            />
            <Input
              className="h-7 text-xs flex-1"
              value={styles.bgColor || ''}
              onChange={(e) => update('bgColor', e.target.value)}
              placeholder="transparent"
            />
          </div>
        </div>

        {/* Border */}
        <div>
          <p className="text-xs font-medium mb-1">Borda</p>
          <div className="grid grid-cols-2 gap-1.5">
            {numField('Raio', 'borderRadius')}
            {numField('Espess.', 'borderWidth')}
          </div>
          <div className="flex gap-2 mt-1.5">
            <Select value={styles.borderStyle || 'none'} onValueChange={(v) => update('borderStyle', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="solid">Sólida</SelectItem>
                <SelectItem value="dashed">Tracejada</SelectItem>
                <SelectItem value="dotted">Pontilhada</SelectItem>
              </SelectContent>
            </Select>
            <input
              type="color"
              value={styles.borderColor || '#e5e7eb'}
              onChange={(e) => update('borderColor', e.target.value)}
              className="w-8 h-7 rounded border cursor-pointer"
            />
          </div>
        </div>

        {/* Shadow */}
        <div>
          <Label className="text-xs">Sombra</Label>
          <Select value={styles.boxShadow || 'none'} onValueChange={(v) => update('boxShadow', v as any)}>
            <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="sm">Pequena</SelectItem>
              <SelectItem value="md">Média</SelectItem>
              <SelectItem value="lg">Grande</SelectItem>
              <SelectItem value="xl">Extra grande</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Text align */}
        <div>
          <Label className="text-xs">Alinhamento de texto</Label>
          <Select value={styles.textAlign || 'left'} onValueChange={(v) => update('textAlign', v as any)}>
            <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Esquerda</SelectItem>
              <SelectItem value="center">Centro</SelectItem>
              <SelectItem value="right">Direita</SelectItem>
              <SelectItem value="justify">Justificado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ocultar no mobile</Label>
            <Switch checked={!!styles.hideOnMobile} onCheckedChange={(v) => update('hideOnMobile', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ocultar no desktop</Label>
            <Switch checked={!!styles.hideOnDesktop} onCheckedChange={(v) => update('hideOnDesktop', v)} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
