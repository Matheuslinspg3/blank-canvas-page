import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadLogoToCloudinary } from '@/lib/cloudinary/uploadLogo';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

export function ImageUploadField({ label, value, onChange }: Props) {
  const { profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const orgId = profile?.organization_id;

  const handleFile = async (file: File) => {
    if (!orgId) {
      toast.error('Organização não encontrada');
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadLogoToCloudinary(file, orgId, 'site-builder');
      onChange(url);
      toast.success('Imagem enviada');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>

      {value && (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-muted">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            onClick={() => onChange('')}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          className="flex-1"
        >
          {isUploading ? (
            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="w-4 h-4 mr-1" /> {value ? 'Trocar' : 'Enviar'} imagem</>
          )}
        </Button>
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="h-7 text-xs"
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
