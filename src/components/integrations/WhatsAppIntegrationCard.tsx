import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, CheckCircle2, XCircle, RefreshCw, QrCode, Trash2, Smartphone } from "lucide-react";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

const QR_REFRESH_INTERVAL = 45_000; // 45 seconds
const STATUS_POLL_INTERVAL = 10_000; // 10 seconds

export function WhatsAppIntegrationCard() {
  const {
    instance,
    isLoading,
    connectInstance,
    checkStatus,
    disconnectInstance,
    deleteInstance,
    isConnecting,
    isCheckingStatus,
    isDisconnecting,
    isDeleting,
  } = useWhatsAppInstance();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  // Store activation context for QR refresh
  const activationCtxRef = useRef<{
    pairingCode: string | null;
    code: string | null;
    count: number;
    orgName: string;
    orgId: string;
    date: string;
    companyId: string;
  } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const stopStatusPolling = useCallback(() => {
    if (statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stopRefresh(); stopStatusPolling(); }, [stopRefresh, stopStatusPolling]);

  const startStatusPolling = useCallback(() => {
    stopStatusPolling();
    statusPollingRef.current = setInterval(async () => {
      const ctx = activationCtxRef.current;
      if (!ctx) return;
      try {
        const { data } = await supabase.functions.invoke("whatsapp-polling-status", {
          body: {
            orgName: ctx.orgName,
            orgId: ctx.orgId,
            date: ctx.date,
            companyId: ctx.companyId,
          },
        });

        const normalizedRaw = String(
          typeof data === "string"
            ? data
            : data?.raw ?? data?.connectionStatus ?? data?.status ?? "",
        )
          .trim()
          .toLowerCase();

        const normalizedStatus = String(data?.connectionStatus ?? data?.status ?? "")
          .trim()
          .toLowerCase();

        const isConnected =
          data?.connected === true ||
          normalizedStatus === "open" ||
          normalizedRaw === "open" ||
          normalizedRaw.includes('"connectionstatus":"open"') ||
          /\bconnected\b|\bopen\b|\bready\b|\bonline\b|\bauthorized\b/.test(normalizedRaw);

        if (isConnected) {
          setQrCode(null);
          stopRefresh();
          stopStatusPolling();
          activationCtxRef.current = null;
          toast.success("WhatsApp conectado com sucesso!");
          checkStatus().catch(() => {});
        }
      } catch { /* silent */ }
    }, STATUS_POLL_INTERVAL);
  }, [stopRefresh, stopStatusPolling, checkStatus]);

  const requestQrRefresh = useCallback(async () => {
    const ctx = activationCtxRef.current;
    if (!ctx) return false;

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-refresh-qrcode", {
        body: {
          pairingCode: ctx.pairingCode,
          code: ctx.code,
          count: ctx.count,
          orgName: ctx.orgName,
          orgId: ctx.orgId,
          date: ctx.date,
          companyId: ctx.companyId,
        },
      });

      if (error || !data?.qrCode) return false;

      setQrCode(data.qrCode);
      if (data.code) ctx.code = data.code;
      if (data.pairingCode) ctx.pairingCode = data.pairingCode;
      if (Number.isFinite(Number(data.count))) ctx.count = Number(data.count);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Refresh QR code every 45s
  const startQrRefresh = useCallback(() => {
    stopRefresh();
    refreshTimerRef.current = setInterval(async () => {
      await requestQrRefresh();
    }, QR_REFRESH_INTERVAL);
  }, [stopRefresh, requestQrRefresh]);

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-activate-webhook", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const payload = data?.payload;
      const hasActivationContext = Boolean(
        payload?.orgName && payload?.orgId && payload?.date && payload?.companyId,
      );

      activationCtxRef.current = hasActivationContext
        ? {
            pairingCode: data.pairingCode ?? null,
            code: data.code ?? null,
            count: Number.isFinite(Number(data.count)) ? Number(data.count) : 1,
            orgName: payload.orgName,
            orgId: payload.orgId,
            date: payload.date,
            companyId: payload.companyId,
          }
        : null;

      if (activationCtxRef.current) {
        startQrRefresh();
        startStatusPolling();
      }

      if (data?.qrCode) {
        setQrCode(data.qrCode);
        toast.success("QR Code gerado! Escaneie com o WhatsApp.");
      } else if (activationCtxRef.current) {
        const refreshedNow = await requestQrRefresh();
        if (refreshedNow) {
          toast.success("QR Code gerado! Escaneie com o WhatsApp.");
        } else {
          toast.success("Ativação enviada! Buscando QR Code automaticamente.");
        }
      } else {
        toast.info("Ativação enviada, mas sem contexto para buscar o QR Code.");
      }
    } catch (err: any) {
      toastError("Erro ao ativar WhatsApp", err instanceof Error ? err : new Error(String(err?.message || err)), { module: "WhatsAppIntegrationCard" });
    } finally {
      setIsActivating(false);
    }
  };

  const handleConnect = async () => {
    try {
      const result = await connectInstance();
      if (result?.qr_code) {
        setQrCode(result.qr_code);
        startStatusPolling();
        return;
      }
      const statusResult = await checkStatus().catch(() => null);
      if (statusResult?.qr_code) {
        setQrCode(statusResult.qr_code);
        startStatusPolling();
        return;
      }
      toastError("Não foi possível obter o QR Code agora.", undefined, { module: "WhatsAppIntegrationCard" });
    } catch { /* toast shown by hook */ }
  };

  const handleCheckStatus = async () => {
    try {
      const result = await checkStatus();
      if (result?.status === "connected") {
        setQrCode(null);
        stopRefresh();
        stopStatusPolling();
        activationCtxRef.current = null;
        return;
      }
      if (result?.qr_code) {
        setQrCode(result.qr_code);
        startStatusPolling();
        return;
      }
      toast.info("Ainda sem QR Code disponível. Aguarde.");
    } catch { /* toast shown by hook */ }
  };

  const normalizeQrSrc = (value?: string | null) => {
    if (!value) return null;
    const t = value.trim();
    if (t.startsWith("data:image") || t.startsWith("http://") || t.startsWith("https://")) return t;
    return `data:image/png;base64,${t}`;
  };

  const displayedQr = normalizeQrSrc(qrCode || instance?.qr_code || null);

  const statusBadge = () => {
    if (!instance) return null;
    switch (instance.status) {
      case "connected":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>;
      case "connecting":
        return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Conectando</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <CardDescription>Integração via Uazapi — envie mensagens automáticas pelo CRM</CardDescription>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : !instance && !qrCode ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ative o WhatsApp para enviar mensagens automáticas diretamente do CRM.
              Este é um add-on cobrado separadamente.
            </p>
            <Button onClick={handleActivate} disabled={isActivating}>
              {isActivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
              Ativar WhatsApp
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Instance info */}
            {instance && (
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Instância:</span>
                  <span className="font-medium">{instance.instance_name}</span>
                </div>
                {instance.phone_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium">{instance.phone_number}</span>
                  </div>
                )}
              </div>
            )}

            {/* QR Code */}
            {displayedQr && instance?.status !== "connected" && (
              <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background">
                <p className="text-sm font-medium">Escaneie o QR Code no WhatsApp</p>
                <img src={displayedQr} alt="QR Code WhatsApp" className="w-48 h-48" />
                <p className="text-xs text-muted-foreground">O QR Code é atualizado automaticamente a cada 45s</p>
                <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={isCheckingStatus}>
                  {isCheckingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Verificar conexão
                </Button>
              </div>
            )}

            {/* QR Code shown before instance exists (activation flow) */}
            {displayedQr && !instance && (
              <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background">
                <p className="text-sm font-medium">Escaneie o QR Code no WhatsApp</p>
                <img src={displayedQr} alt="QR Code WhatsApp" className="w-48 h-48" />
                <p className="text-xs text-muted-foreground">O QR Code é atualizado automaticamente a cada 45s</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {instance && instance.status !== "connected" && (
                <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                  {qrCode ? "Novo QR Code" : "Conectar"}
                </Button>
              )}

              {instance?.status === "connected" && (
                <Button variant="outline" size="sm" onClick={() => disconnectInstance()} disabled={isDisconnecting}>
                  {isDisconnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              )}

              {instance && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={isCheckingStatus}>
                    {isCheckingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Verificar status
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" /> Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover instância WhatsApp?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá desconectar e remover permanentemente a instância WhatsApp desta organização.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { deleteInstance(); setQrCode(null); stopRefresh(); stopStatusPolling(); activationCtxRef.current = null; }} disabled={isDeleting}>
                          {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
