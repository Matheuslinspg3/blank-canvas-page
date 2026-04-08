import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function PropertyCardInspector({ element, onChange }: Props) {
  const { propertyId, variant } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">ID do imóvel (ou vazio = último)</Label>
        <Input className="mt-1" value={propertyId || ''} onChange={(e) => updateProp('propertyId', e.target.value)} placeholder="UUID ou vazio" />
      </div>
      <div>
        <Label className="text-xs">Variante</Label>
        <Select value={variant || 'vertical'} onValueChange={(v) => updateProp('variant', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vertical">Vertical</SelectItem>
            <SelectItem value="horizontal">Horizontal</SelectItem>
            <SelectItem value="minimal">Minimal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
