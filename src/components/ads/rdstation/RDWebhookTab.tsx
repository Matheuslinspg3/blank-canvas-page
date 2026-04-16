import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Link2, Webhook as WebhookIcon, RefreshCw, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useRDStationSettings } from "@/hooks/useRDStationSettings";
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
import { ScrollArea } from "@/components/ui/scroll-area";

export default function RDWebhookTab() {
  const { settings, webhookLogs, orgId, queryClient } = useRDStationSettings();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const regenerateWebhook = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const newSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase
        .from("rd_station_settings")
        .update({ webhook_secret: newSecret })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("Webhook regenerado! Atualize a URL no RD Station.");
    },
    onError: (e: any) => toastError("Erro na operação", e, { module: "RDWebhookTab" }),
  });

  const reprocessWebhook = useMutation({
    mutationFn: async (logId: string) => {
      const targetLog = webhookLogs.find((log) => log.id === logId);

      if (!targetLog) {
        throw new Error("Log não encontrado para reprocessamento.");
      }

      if (!settings?.webhook_secret) {
        throw new Error("Webhook do RD Station não está configurado.");
      }

      if (!orgId) {
        throw new Error("Organização não identificada.");
      }

      const payload = targetLog.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Payload do webhook inválido para reprocessamento.");
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente para ressincronizar.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rd-station-webhook?org=${orgId.slice(0, 8)}&token=${settings.webhook_secret}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "X-RD-Reprocess-Log-Id": logId,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `Erro HTTP ${response.status}`);
      }

      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      const processed = Array.isArray(data?.results) ? data.results[0] : null;
      const status = processed?.status;
      const statusLabel =
        status === "created" ? "lead criado" :
        status === "duplicate" ? "lead já existia" :
        status === "received_not_sent" ? "lead recebido" :
        "webhook reprocessado";

      toast.success(`Reprocessamento concluído: ${statusLabel}.`);
      queryClient.invalidateQueries({ queryKey: ["rd-station-logs", orgId] });
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings", orgId] });
      queryClient.invalidateQueries({ queryKey: ["rd-station-leads", orgId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setConfirmOpen(false);
      setSelectedLogId(null);
    },
    onError: (e: any) => {
      toastError("Erro ao reprocessar webhook.", e, { module: "RDWebhookTab" });
      setConfirmOpen(false);
    },
  });

  const webhookUrl = settings
    ? `https://api.portadocorretor.com.br/rd-station-webhook?org=${orgId?.slice(0, 8)}&token=${settings.webhook_secret}`
    : "";

  const errorLogs = useMemo(
    () => webhookLogs.filter((log) => log.status === "error"),
    [webhookLogs]
  );

  const selectedLog = selectedLogId
    ? webhookLogs.find((log) => log.id === selectedLogId) ?? null
    : null;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  const getLeadLabel = (payload: Record<string, unknown> | null) => {
    if (!payload) return "Lead";

    const directName = payload.name as string | undefined;
    const directEmail = payload.email as string | undefined;

    if (directName || directEmail) {
      return directName || directEmail || "Lead";
    }

    const nestedLead = Array.isArray(payload.leads)
      ? (payload.leads[0] as Record<string, unknown> | undefined)
      : undefined;

    return (nestedLead?.name as string) || (nestedLead?.email as string) || "Lead";
  };

  const handleOpenReprocess = (logId: string) => {
    setSelectedLogId(logId);
    setConfirmOpen(true);
  };

  const handleConfirmReprocess = () => {
    if (!selectedLogId) return;
    reprocessWebhook.mutate(selectedLogId);
  };

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <WebhookIcon className="h-4 w-4" />
            URL do Webhook
          </CardTitle>
          <CardDescription>
            Cole esta URL no RD Station em Integrações → Webhooks → Nova integração.
            Os leads serão recebidos automaticamente no CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              URL do Webhook
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (confirm("Tem certeza? A URL atual deixará de funcionar e você precisará atualizar no RD Station.")) {
                    regenerateWebhook.mutate();
                  }
                }}
                disabled={regenerateWebhook.isPending}
                title="Regenerar token"
              >
                {regenerateWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Últimos Webhooks Recebidos
          </CardTitle>
          <CardDescription>
            Histórico dos últimos leads recebidos do RD Station via webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorLogs.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {errorLogs.length} webhook{errorLogs.length !== 1 ? "s" : ""} com erro pronto{errorLogs.length !== 1 ? "s" : ""} para ressincronizar
                </p>
                <p className="text-xs text-muted-foreground">
                  Agora você pode reprocessar cada lead com erro direto por aqui usando o payload salvo no log.
                </p>
              </div>
            </div>
          )}
          {webhookLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum webhook recebido ainda. Configure o webhook no RD Station para começar.
            </p>
          ) : (
            <ScrollArea className="max-h-96 pr-3">
            <div className="space-y-2">
              {webhookLogs.map((log) => {
                const payload = log.payload as Record<string, unknown> | null;
                const canReprocess = log.status === "error";
                const isCurrentLogPending = reprocessWebhook.isPending && selectedLogId === log.id;
                return (
                <div key={log.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {getLeadLabel(payload)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge
                        variant={
                          log.status === "created" ? "default" :
                          log.status === "duplicate" ? "secondary" :
                          log.status === "error" ? "destructive" : "outline"
                        }
                        className="shrink-0"
                      >
                        {log.status === "created" ? "Criado" :
                         log.status === "duplicate" ? "Duplicado" :
                         log.status === "error" ? "Erro" :
                         log.status === "received_not_sent" ? "Recebido" :
                         log.status === "reprocessing" ? "Reprocessando" : log.status}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <p className="mt-2 text-xs text-destructive break-words">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                  {canReprocess && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleOpenReprocess(log.id)}
                      disabled={reprocessWebhook.isPending}
                    >
                      {isCurrentLogPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      {isCurrentLogPending ? "Reprocessando..." : "Ressincronizar"}
                    </Button>
                  )}
                </div>
                );
              })}
            </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open && !reprocessWebhook.isPending) {
            setSelectedLogId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ressincronizar lead com erro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Vou reenviar o payload salvo do webhook para tentar criar esse lead novamente no CRM.
                </p>
                {selectedLog && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p><strong className="text-foreground">Lead:</strong> {getLeadLabel(selectedLog.payload as Record<string, unknown> | null)}</p>
                    <p><strong className="text-foreground">Recebido em:</strong> {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    {selectedLog.error_message && (
                      <p className="mt-1 break-words"><strong className="text-foreground">Erro:</strong> {selectedLog.error_message}</p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reprocessWebhook.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReprocess} disabled={reprocessWebhook.isPending}>
              {reprocessWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {reprocessWebhook.isPending ? "Ressincronizando..." : "Confirmar ressincronização"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
