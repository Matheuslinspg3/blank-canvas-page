import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSiteDocument, useSwitchEditorMode } from "@/hooks/useSiteDocument";
import { useAuth } from "@/contexts/AuthContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const SiteSettingsTab = lazy(() => import("@/components/settings/SiteSettingsTab"));

export default function SitePage() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const { data: siteDoc } = useSiteDocument(organization?.id);
  const switchMode = useSwitchEditorMode();
  const [pendingMode, setPendingMode] = useState<'simple' | 'advanced' | null>(null);

  const editorMode = siteDoc?.editor_mode ?? 'simple';

  const handleModeChange = (value: string) => {
    const newMode = value as 'simple' | 'advanced';
    if (newMode !== editorMode) {
      setPendingMode(newMode);
    }
  };

  const confirmModeSwitch = () => {
    if (!siteDoc || !pendingMode) return;
    switchMode.mutate(
      { id: siteDoc.id, mode: pendingMode },
      {
        onSuccess: () => {
          toast.success(`Modo alterado para ${pendingMode === 'advanced' ? 'Avançado' : 'Simples'}`);
          setPendingMode(null);
        },
        onError: () => {
          toast.error('Erro ao trocar o modo do editor');
          setPendingMode(null);
        },
      }
    );
  };

  const openEditor = () => {
    if (editorMode === 'advanced') {
      navigate('/site/builder-pro');
    } else {
      navigate('/site/builder');
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Meu Site"
        description="Configure o conteúdo, aparência e domínio do site da sua imobiliária"
      />
      <div className="relative flex-1 p-4 sm:p-6">
        <Card className="mb-6">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6">
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Modo do editor</p>
              <RadioGroup
                value={editorMode}
                onValueChange={handleModeChange}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="simple" id="mode-simple" />
                  <Label htmlFor="mode-simple" className="cursor-pointer">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                    Simples
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="advanced" id="mode-advanced" />
                  <Label htmlFor="mode-advanced" className="cursor-pointer">
                    <Wand2 className="w-3.5 h-3.5 inline mr-1" />
                    Avançado
                    <Badge variant="secondary" className="ml-1 text-[10px]">Beta</Badge>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <Button onClick={openEditor} className="gap-2">
              {editorMode === 'advanced' ? <Wand2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              Abrir Editor {editorMode === 'advanced' ? 'Avançado' : 'Visual'}
              <Badge variant="secondary" className="ml-1 text-[10px]">Beta</Badge>
            </Button>
          </CardContent>
        </Card>

        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <SiteSettingsTab />
        </Suspense>
      </div>

      <AlertDialog open={!!pendingMode} onOpenChange={(open) => !open && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar modo do editor?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMode === 'advanced'
                ? 'Trocar para o modo avançado fará seu site público mostrar o conteúdo do editor avançado. Se você ainda não criou conteúdo lá, o site ficará vazio até você publicar.'
                : 'Trocar para o modo simples fará seu site público voltar a mostrar o conteúdo do editor simples.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmModeSwitch}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
