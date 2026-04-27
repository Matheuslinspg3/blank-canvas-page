import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, History } from "lucide-react";
import { usePropertyReviewSettings } from "@/hooks/usePropertyReviewSettings";
import { useUpdatePropertyReviewSettings } from "@/hooks/useUpdatePropertyReviewSettings";
import { useUserRoles } from "@/hooks/useUserRole";

export function PropertyReviewSettingsCard() {
  const { settings, isLoading } = usePropertyReviewSettings();
  const update = useUpdatePropertyReviewSettings();
  const { isAdminOrAbove } = useUserRoles();
  const canEdit = isAdminOrAbove;

  const [overdueAfterDays, setOverdueAfterDays] = useState<number>(settings.overdueAfterDays);
  const [warningBeforeDays, setWarningBeforeDays] = useState<number>(settings.warningBeforeDays);
  const [showDashboardCard, setShowDashboardCard] = useState<boolean>(settings.showDashboardCard);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOverdueAfterDays(settings.overdueAfterDays);
    setWarningBeforeDays(settings.warningBeforeDays);
    setShowDashboardCard(settings.showDashboardCard);
  }, [settings.overdueAfterDays, settings.warningBeforeDays, settings.showDashboardCard]);

  const validate = (): string | null => {
    if (!Number.isFinite(overdueAfterDays) || overdueAfterDays < 7 || overdueAfterDays > 365) {
      return "Prazo de desatualização deve estar entre 7 e 365 dias.";
    }
    if (!Number.isFinite(warningBeforeDays) || warningBeforeDays < 1 || warningBeforeDays > 60) {
      return "Aviso deve estar entre 1 e 60 dias.";
    }
    if (warningBeforeDays >= overdueAfterDays) {
      return "O aviso deve ser menor que o prazo de desatualização.";
    }
    return null;
  };

  const handleSave = () => {
    const err = validate();
    setError(err);
    if (err) return;
    update.mutate({ overdueAfterDays, warningBeforeDays, showDashboardCard });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Controle de revisão de imóveis</CardTitle>
            <CardDescription>
              Defina quando um imóvel é considerado desatualizado e como avisar a equipe.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!canEdit && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Apenas líderes, donos e sub-donos podem alterar essa configuração.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="overdue-days">Considerar imóvel desatualizado após (dias)</Label>
            <Input
              id="overdue-days"
              type="number"
              min={7}
              max={365}
              value={overdueAfterDays}
              onChange={(e) => setOverdueAfterDays(Number(e.target.value))}
              disabled={!canEdit || isLoading}
            />
            <p className="text-xs text-muted-foreground">Entre 7 e 365 dias.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="warning-days">Avisar quando estiver faltando (dias)</Label>
            <Input
              id="warning-days"
              type="number"
              min={1}
              max={60}
              value={warningBeforeDays}
              onChange={(e) => setWarningBeforeDays(Number(e.target.value))}
              disabled={!canEdit || isLoading}
            />
            <p className="text-xs text-muted-foreground">Entre 1 e 60 dias, menor que o prazo acima.</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="show-card" className="text-sm font-medium">Exibir imóveis desatualizados no dashboard</Label>
            <p className="text-xs text-muted-foreground">Mostra um card com lista crítica e contadores na tela inicial.</p>
          </div>
          <Switch
            id="show-card"
            checked={showDashboardCard}
            onCheckedChange={setShowDashboardCard}
            disabled={!canEdit || isLoading}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={update.isPending || isLoading}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar configuração
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
