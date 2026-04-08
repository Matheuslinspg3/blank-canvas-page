import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function PropertyListInspector({ element, onChange }: Props) {
  const { heading, source, filterCity, filterMinBedrooms, filterTransactionType, limit, columns, cardVariant } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Título</Label>
        <Input className="mt-1" value={heading || ''} onChange={(e) => updateProp('heading', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Fonte</Label>
        <Select value={source || 'all'} onValueChange={(v) => updateProp('source', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="featured">Destaques</SelectItem>
            <SelectItem value="by_filter">Por filtro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {source === 'by_filter' && (
        <>
          <div>
            <Label className="text-xs">Cidade</Label>
            <Input className="mt-1" value={filterCity || ''} onChange={(e) => updateProp('filterCity', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Quartos mín.</Label>
            <Input type="number" className="mt-1" value={filterMinBedrooms || ''} onChange={(e) => updateProp('filterMinBedrooms', Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Tipo de transação</Label>
            <Select value={filterTransactionType || 'all'} onValueChange={(v) => updateProp('filterTransactionType', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sale">Venda</SelectItem>
                <SelectItem value="rent">Aluguel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Colunas</Label>
          <Select value={String(columns || 3)} onValueChange={(v) => updateProp('columns', Number(v))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Limite</Label>
          <Input type="number" className="mt-1" value={limit || 6} onChange={(e) => updateProp('limit', Number(e.target.value))} />
        </div>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
