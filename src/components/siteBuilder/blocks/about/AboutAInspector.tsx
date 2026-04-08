import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { AboutABlock } from '@/types/siteBuilder';

interface Props { block: AboutABlock; onChange: (props: AboutABlock['props']) => void; }

export function AboutAInspector({ block, onChange }: Props) {
  const { register, watch } = useForm({ defaultValues: block.props });
  useEffect(() => {
    const sub = watch((v) => { const t = setTimeout(() => onChange(v as AboutABlock['props']), 300); return () => clearTimeout(t); });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Conteúdo</h3>
      <div className="space-y-2"><Label>Título</Label><Input {...register('title')} /></div>
      <div className="space-y-2"><Label>Texto</Label><Textarea {...register('text')} rows={6} /></div>
      <div className="space-y-2">
        <Label>Imagem (URL)</Label><Input {...register('image')} />
        {/* LOVABLE: TODO trocar por upload Cloudinary na FASE 4 */}
      </div>
    </div>
  );
}
