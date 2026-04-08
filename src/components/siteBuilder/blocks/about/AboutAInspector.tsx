import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageUploadField } from '@/components/siteBuilder/ImageUploadField';
import type { AboutABlock } from '@/types/siteBuilder';

interface Props { block: AboutABlock; onChange: (props: AboutABlock['props']) => void; }

export function AboutAInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });
  useEffect(() => {
    const sub = watch((v) => { const t = setTimeout(() => onChange(v as AboutABlock['props']), 300); return () => clearTimeout(t); });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  const handleImageChange = useCallback((url: string) => {
    setValue('image', url, { shouldDirty: true });
  }, [setValue]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Conteúdo</h3>
      <div className="space-y-2"><Label>Título</Label><Input {...register('title')} /></div>
      <div className="space-y-2"><Label>Texto</Label><Textarea {...register('text')} rows={6} /></div>
      <ImageUploadField label="Imagem" value={watch('image')} onChange={handleImageChange} />
    </div>
  );
}
