import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { ContactABlock } from '@/types/siteBuilder';

interface Props { block: ContactABlock; onChange: (props: ContactABlock['props']) => void; }

export function ContactAInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });
  useEffect(() => {
    const sub = watch((v) => { const t = setTimeout(() => onChange(v as ContactABlock['props']), 300); return () => clearTimeout(t); });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Conteúdo</h3>
      <div className="space-y-2"><Label>Título</Label><Input {...register('title')} /></div>
      <div className="space-y-2"><Label>Subtítulo</Label><Input {...register('subtitle')} /></div>
      <Separator />
      <h3 className="font-semibold text-sm text-muted-foreground">Comportamento</h3>
      <div className="flex items-center justify-between"><Label>Mostrar mapa</Label><Switch checked={watch('showMap')} onCheckedChange={(v) => setValue('showMap', v, { shouldDirty: true })} /></div>
      <div className="flex items-center justify-between"><Label>Mostrar formulário</Label><Switch checked={watch('showForm')} onCheckedChange={(v) => setValue('showForm', v, { shouldDirty: true })} /></div>
    </div>
  );
}
