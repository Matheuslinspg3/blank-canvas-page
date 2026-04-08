import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ContactBBlock } from '@/types/siteBuilder';

interface Props { block: ContactBBlock; onChange: (props: ContactBBlock['props']) => void; }

export function ContactBInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });
  useEffect(() => {
    const sub = watch((v) => { const t = setTimeout(() => onChange(v as ContactBBlock['props']), 300); return () => clearTimeout(t); });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Conteúdo</h3>
      <div className="space-y-2"><Label>Título</Label><Input {...register('title')} /></div>
      <div className="space-y-2"><Label>Subtítulo</Label><Input {...register('subtitle')} /></div>
      <Separator />
      <h3 className="font-semibold text-sm text-muted-foreground">Aparência</h3>
      <div className="space-y-2">
        <Label>Cor de fundo</Label>
        <div className="flex gap-2 items-center"><input type="color" {...register('bgColor')} className="w-8 h-8 rounded cursor-pointer" /><Input {...register('bgColor')} className="flex-1" /></div>
      </div>
      <div className="space-y-2">
        <Label>Layout</Label>
        <Select value={watch('layout')} onValueChange={(v) => setValue('layout', v as 'stacked' | 'side-by-side', { shouldDirty: true })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stacked">Empilhado</SelectItem>
            <SelectItem value="side-by-side">Lado a lado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
