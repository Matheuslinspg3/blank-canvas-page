import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PropertyGridBBlock } from '@/types/siteBuilder';

interface Props {
  block: PropertyGridBBlock;
  onChange: (props: PropertyGridBBlock['props']) => void;
}

export function PropertyGridBInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });

  useEffect(() => {
    const sub = watch((v) => {
      const timer = setTimeout(() => onChange(v as PropertyGridBBlock['props']), 300);
      return () => clearTimeout(timer);
    });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Conteúdo</h3>
      <div className="space-y-2">
        <Label>Título</Label>
        <Input {...register('title')} />
      </div>
      <div className="space-y-2">
        <Label>Subtítulo</Label>
        <Input {...register('subtitle')} />
      </div>

      <Separator />
      <h3 className="font-semibold text-sm text-muted-foreground">Comportamento</h3>
      <div className="space-y-2">
        <Label>Colunas</Label>
        <Input type="number" min={2} max={3} {...register('columns', { valueAsNumber: true })} />
      </div>
      <div className="space-y-2">
        <Label>Máximo de itens</Label>
        <Input type="number" min={1} max={24} {...register('maxItems', { valueAsNumber: true })} />
      </div>
      <div className="space-y-2">
        <Label>Estilo do card</Label>
        <Select value={watch('cardStyle')} onValueChange={(v) => setValue('cardStyle', v as 'rounded' | 'square', { shouldDirty: true })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rounded">Arredondado</SelectItem>
            <SelectItem value="square">Quadrado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
