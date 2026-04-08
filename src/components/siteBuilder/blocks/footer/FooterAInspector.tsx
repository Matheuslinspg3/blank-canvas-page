import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { FooterABlock } from '@/types/siteBuilder';

interface Props { block: FooterABlock; onChange: (props: FooterABlock['props']) => void; }

export function FooterAInspector({ block, onChange }: Props) {
  const { register, watch, setValue } = useForm({ defaultValues: block.props });
  useEffect(() => {
    const sub = watch((v) => { const t = setTimeout(() => onChange(v as FooterABlock['props']), 300); return () => clearTimeout(t); });
    return () => sub.unsubscribe();
  }, [watch, onChange]);

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold text-sm text-muted-foreground">Comportamento</h3>
      <div className="flex items-center justify-between"><Label>Redes sociais</Label><Switch checked={watch('showSocial')} onCheckedChange={(v) => setValue('showSocial', v, { shouldDirty: true })} /></div>
      <div className="flex items-center justify-between"><Label>Créditos</Label><Switch checked={watch('showCredits')} onCheckedChange={(v) => setValue('showCredits', v, { shouldDirty: true })} /></div>
      <Separator />
      <h3 className="font-semibold text-sm text-muted-foreground">Aparência</h3>
      <div className="flex gap-4">
        <div className="space-y-2 flex-1"><Label>Cor de fundo</Label><div className="flex gap-2 items-center"><input type="color" {...register('bgColor')} className="w-8 h-8 rounded cursor-pointer" /><Input {...register('bgColor')} className="flex-1" /></div></div>
        <div className="space-y-2 flex-1"><Label>Cor do texto</Label><div className="flex gap-2 items-center"><input type="color" {...register('textColor')} className="w-8 h-8 rounded cursor-pointer" /><Input {...register('textColor')} className="flex-1" /></div></div>
      </div>
    </div>
  );
}
