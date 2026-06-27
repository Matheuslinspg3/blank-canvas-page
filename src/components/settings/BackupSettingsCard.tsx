import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CloudUpload, HardDriveDownload, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { cn } from "@/lib/utils";
import { useUserRoles } from "@/hooks/useUserRole";
import {
  useBackupSettings,
  useBackupEstimate,
  startDriveOAuth,
  formatBytes,
  type BackupFrequency,
} from "@/hooks/useBackupSettings";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function BackupSettingsCard() {
  const { isAdminOrAbove } = useUserRoles();
  const { settings, isLoading, save } = useBackupSettings();
  const connected = !!settings?.drive_root_folder_id;
  const estimate = useBackupEstimate(isAdminOrAbove && connected);

  const [connecting, setConnecting] = useState(false);

  // Trata o retorno do OAuth (redirect do callback) uma vez.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive_success")) {
      toast.success("Google Drive conectado com sucesso.");
      cleanUrl();
    } else if (params.get("drive_error")) {
      toastError(new Error(`Não foi possível conectar o Google Drive (${params.get("drive_error")}).`));
      cleanUrl();
    }
  }, []);

  // TRAVA: de hora em hora só sem fotos. (hooks/derivados antes de qualquer early return)
  const includePhotos = settings?.include_photos ?? false;
  const frequency = settings?.frequency ?? "fixed_daily";
  const hourlyDisabled = includePhotos;

  const currentScopeBytes = useMemo(() => {
    const e = estimate.data;
    if (!e) return null;
    if (!includePhotos) return e.scopes.data_only;
    const orig = settings?.photo_original ? e.bytes.photos_original : 0;
    const thumb = settings?.photo_thumbnail ? e.bytes.photos_thumbnail : 0;
    return e.bytes.data + orig + thumb;
  }, [estimate.data, includePhotos, settings?.photo_original, settings?.photo_thumbnail]);

  if (!isAdminOrAbove) return null;

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const url = await startDriveOAuth();
      window.location.href = url;
    } catch (e) {
      toastError(e);
      setConnecting(false);
    }
  };

  const patch = (p: Parameters<typeof save.mutate>[0]) =>
    save.mutate(p, {
      onSuccess: () => toast.success("Configuração de backup salva."),
      onError: (e) => toastError(e),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudUpload className="h-5 w-5 text-muted-foreground" />
          Backup no Google Drive
        </CardTitle>
        <CardDescription>
          Backup automático de leads e imóveis (e fotos, opcional) na conta de Google Drive da sua
          imobiliária. Só administradores podem conectar e configurar.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Conexão */}
        {!connected ? (
          <div className="rounded-md border p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte uma conta do Google Drive. O app cria e enxerga apenas a pasta
              <span className="font-medium"> “Portal Corretor Backups”</span> — nada mais do seu Drive.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDriveDownload className="h-4 w-4 mr-2" />}
              Conectar Google Drive
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span>
              Conectado{settings?.drive_account_email ? ` como ${settings.drive_account_email}` : ""}.
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={handleConnect} disabled={connecting}>
              Reconectar
            </Button>
          </div>
        )}

        {connected && (
          <>
            <Separator />

            {/* Ativar */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Backup ativado</Label>
                <p className="text-xs text-muted-foreground">Liga/desliga a execução automática.</p>
              </div>
              <Switch
                checked={settings?.enabled ?? false}
                onCheckedChange={(v) => patch({ enabled: v })}
                disabled={save.isPending || isLoading}
              />
            </div>

            <Separator />

            {/* Escopo: fotos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Incluir fotos dos imóveis</Label>
                  <p className="text-xs text-muted-foreground">
                    Dados (leads e imóveis) são sempre incluídos. Fotos são opcionais.
                  </p>
                </div>
                <Switch
                  checked={includePhotos}
                  onCheckedChange={(v) =>
                    // Ao ligar fotos, se estava "de hora em hora", força "fixo" (trava).
                    patch(
                      v && frequency === "hourly"
                        ? { include_photos: true, frequency: "fixed_daily" }
                        : { include_photos: v },
                    )
                  }
                  disabled={save.isPending}
                />
              </div>

              {includePhotos && (
                <div className="ml-1 flex flex-wrap gap-4 pl-3 border-l">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={settings?.photo_original ?? true}
                      onCheckedChange={(v) => patch({ photo_original: v })}
                      disabled={save.isPending}
                    />
                    Original
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={settings?.photo_thumbnail ?? false}
                      onCheckedChange={(v) => patch({ photo_thumbnail: v })}
                      disabled={save.isPending}
                    />
                    Miniatura
                  </label>
                </div>
              )}
            </div>

            <Separator />

            {/* Frequência */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Frequência</Label>
              <RadioGroup
                value={frequency}
                onValueChange={(v) => patch({ frequency: v as BackupFrequency })}
                className="space-y-2"
              >
                <label className={cn("flex items-start gap-3 rounded-md border p-3", frequency === "fixed_daily" ? "border-primary bg-primary/5" : "border-border")}>
                  <RadioGroupItem value="fixed_daily" id="freq-fixed" className="mt-1" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Horário fixo (1×/dia)</div>
                    <div className="text-xs text-muted-foreground">No horário definido pela organização.</div>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3",
                    frequency === "hourly" ? "border-primary bg-primary/5" : "border-border",
                    hourlyDisabled && "opacity-60",
                  )}
                >
                  <RadioGroupItem value="hourly" id="freq-hourly" className="mt-1" disabled={hourlyDisabled} />
                  <div className="flex-1">
                    <div className="text-sm font-medium">De hora em hora</div>
                    <div className="text-xs text-muted-foreground">
                      Apenas dados. {hourlyDisabled && "Indisponível com fotos ativadas."}
                    </div>
                  </div>
                </label>
              </RadioGroup>

              {frequency === "fixed_daily" && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Horário</Label>
                  <Select
                    value={String(settings?.run_hour ?? 22)}
                    onValueChange={(v) => patch({ run_hour: parseInt(v, 10) })}
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{settings?.timezone ?? "America/Sao_Paulo"}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Retenção + espelho */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Retenção do histórico</Label>
                <Select
                  value={String(settings?.retention_days ?? 30)}
                  onValueChange={(v) => patch({ retention_days: parseInt(v, 10) })}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Refletir exclusões</Label>
                  <p className="text-xs text-muted-foreground">
                    Ao excluir um imóvel/lead, ele é removido da pasta <span className="font-medium">atual/</span> no
                    próximo backup. O histórico é preservado até a retenção vencer.
                  </p>
                </div>
                <Switch
                  checked={settings?.mirror_deletions ?? true}
                  onCheckedChange={(v) => patch({ mirror_deletions: v })}
                  disabled={save.isPending}
                />
              </div>
            </div>

            <Separator />

            {/* Estimativa precisa */}
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Tamanho estimado do backup</Label>
                {estimate.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {estimate.data ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Dados ({estimate.data.counts.leads} leads, {estimate.data.counts.properties} imóveis)</span>
                    <span>{formatBytes(estimate.data.bytes.data)}</span>
                  </div>
                  {includePhotos && settings?.photo_original && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fotos originais ({estimate.data.counts.photos_original})</span>
                      <span>{formatBytes(estimate.data.bytes.photos_original)}</span>
                    </div>
                  )}
                  {includePhotos && settings?.photo_thumbnail && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Miniaturas ({estimate.data.counts.photos_thumbnail})</span>
                      <span>{formatBytes(estimate.data.bytes.photos_thumbnail)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-medium">
                    <span>Total por execução</span>
                    <span>{currentScopeBytes != null ? formatBytes(currentScopeBytes) : "—"}</span>
                  </div>
                  {estimate.data.note && (
                    <p className="flex items-center gap-1 text-xs text-warning-foreground/90">
                      <ShieldAlert className="h-3 w-3" /> {estimate.data.note}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {estimate.isError ? "Não foi possível calcular agora." : "Calculando…"}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
