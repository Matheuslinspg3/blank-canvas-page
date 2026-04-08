import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { AboutBBlock } from '@/types/siteBuilder';

interface Props { block: AboutBBlock; onChange: (props: AboutBBlock['props']) => void; }

export function AboutBInspector({ block, onChange }: Props) {
  const { register, watch } = useForm({ defaultValues: block.props });
  useEffect(() => {
    const sub = watch((v) => { const t = setTimeout(() => onChange(v as AboutBBlock['props']), 300); return () => clearTimeout(t); });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Conteúdo</h3>
      <div className="space-y-2"><Label>Título</Label><Input {...register('title')} /></div>
      <div className="space-y-2"><Label>Texto</Label><Textarea {...register('text')} rows={6} /></div>
      <Separator />
      <h3 className="font-semibold text-sm text-muted-foreground">Aparência</h3>
      <div className="flex gap-4">
        <div className="space-y-2 flex-1">
          <Label>Cor de fundo</Label>
          <div className="flex gap-2 items-center"><input type="color" {...register('bgColor')} className="w-8 h-8 rounded cursor-pointer" /><Input {...register('bgColor')} className="flex-1" /></div>
        </div>
        <div className="space-y-2 flex-1">
          <Label>Cor do texto</Label>
          <div className="flex gap-2 items-center"><input type="color" {...register('textColor')} className="w-8 h-8 rounded cursor-pointer" /><Input {...register('textColor')} className="flex-1" /></div>
        </div>
      </div>
    </div>
  );
}
