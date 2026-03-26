import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { XCircle } from 'lucide-react';

const INACTIVATION_REASONS = [
  'Sem interesse',
  'Não atende telefone',
  'Comprou com concorrente',
  'Fora do perfil',
  'Sem condições financeiras',
  'Desistiu da compra/aluguel',
  'Lead duplicado',
  'Dados inválidos',
  'Outro',
];

interface InactivateLeadDialogProps {
  leadName: string;
  onConfirm: (reason?: string) => void;
  isInactivating?: boolean;
}

export function InactivateLeadDialog({ leadName, onConfirm, isInactivating }: InactivateLeadDialogProps) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    const finalReason = reason === 'Outro' ? customReason : reason;
    onConfirm(finalReason || undefined);
    setOpen(false);
    setReason('');
    setCustomReason('');
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="secondary" className="flex-1">
          <XCircle className="h-4 w-4 mr-2" />
          Inativar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="mx-4 sm:mx-0">
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar lead?</AlertDialogTitle>
          <AlertDialogDescription>
            O lead "{leadName}" será movido para a lista de inativos. Você poderá reativá-lo a qualquer momento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Motivo da inativação</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {INACTIVATION_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reason === 'Outro' && (
            <Input
              placeholder="Descreva o motivo..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}
        </div>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="sm:w-auto w-full">Cancelar</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={isInactivating}
            className="sm:w-auto w-full"
          >
            {isInactivating ? 'Inativando...' : 'Inativar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
