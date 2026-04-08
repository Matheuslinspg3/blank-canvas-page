import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { PropertyGridABlock } from '@/types/siteBuilder';

interface Props {
  block: PropertyGridABlock;
  onChange: (props: PropertyGridABlock['props']) => void;
}

export function PropertyGridAInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });

  useEffect(() => {
    const sub = watch((v) => {
      const timer = setTimeout(() => onChange(v as PropertyGridABlock['props']), 300);
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
        <Input type="number" min={2} max={4} {...register('columns', { valueAsNumber: true })} />
      </div>
      <div className="space-y-2">
        <Label>Máximo de itens</Label>
        <Input type="number" min={1} max={24} {...register('maxItems', { valueAsNumber: true })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Mostrar filtros</Label>
        <Switch
          checked={watch('showFilters')}
          onCheckedChange={(v) => setValue('showFilters', v, { shouldDirty: true })}
        />
      </div>
    </div>
  );
}
