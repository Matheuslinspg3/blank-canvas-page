import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { PropertyCarouselABlock } from '@/types/siteBuilder';

interface Props {
  block: PropertyCarouselABlock;
  onChange: (props: PropertyCarouselABlock['props']) => void;
}

export function PropertyCarouselAInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });

  useEffect(() => {
    const sub = watch((v) => {
      const timer = setTimeout(() => onChange(v as PropertyCarouselABlock['props']), 300);
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
        <Label>Máximo de itens</Label>
        <Input type="number" min={1} max={20} {...register('maxItems', { valueAsNumber: true })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Autoplay</Label>
        <Switch checked={watch('autoplay')} onCheckedChange={(v) => setValue('autoplay', v, { shouldDirty: true })} />
      </div>
      {watch('autoplay') && (
        <div className="space-y-2">
          <Label>Intervalo (ms)</Label>
          <Input type="number" min={1000} step={500} {...register('interval', { valueAsNumber: true })} />
        </div>
      )}
    </div>
  );
}
