import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Loader2, MessageCircle, CheckCircle2, XCircle, RefreshCw, Trash2, Smartphone, QrCode, Hash } from "lucide-react";
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

const QR_REFRESH_INTERVAL = 45_000;
const STATUS_POLL_INTERVAL = 10_000;

export function WhatsAppIntegrationCard() {
  const {
    instance,
    isLoading,
    checkStatus,
    disconnectInstance,
    deleteInstance,
    isCheckingStatus,
    isDisconnecting,
    isDeleting,
  } = useWhatsAppInstance();
  const queryClient = useQueryClient();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<{ code: string; message: string } | null>(null);
  const [connectionMode, setConnectionMode] = useState<"qr" | "pairing">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const isActiveRef = useRef(false);
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

  useEffect(() => () => { stopRefresh(); stopStatusPolling(); }, [stopRefresh, stopStatusPolling]);

  // Auto-check status on mount
  const hasAutoCheckedRef = useRef(false);
  useEffect(() => {
    if (hasAutoCheckedRef.current) return;
    if (isLoading || !instance) return;

    hasAutoCheckedRef.current = true;

    if (instance.status === "connected") {
      setQrCode(null);
      setPairingCode(null);
      return;
    }

    checkStatus()
      .then((result) => {
        if (result?.status === "connected") {
          setQrCode(null);
          setPairingCode(null);
          stopRefresh();
          stopStatusPolling();
          isActiveRef.current = false;
        } else if (result?.qr_code) {
          setQrCode(result.qr_code);
        }
      })
      .catch(() => {});
  }, [isLoading, instance, checkStatus, stopRefresh, stopStatusPolling, queryClient]);

  const startStatusPolling = useCallback(() => {
    stopStatusPolling();
    statusPollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("whatsapp-polling-status", {
          body: {},
        });

        const isConnected = data?.connected === true;

        if (isConnected) {
          setQrCode(null);
          setPairingCode(null);
          stopRefresh();
          stopStatusPolling();
          isActiveRef.current = false;
          toast.success("WhatsApp conectado com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
        }
      } catch { /* silent */ }
    }, STATUS_POLL_INTERVAL);
  }, [stopRefresh, stopStatusPolling, checkStatus, queryClient]);

  const requestQrRefresh = useCallback(async () => {
    if (!isActiveRef.current) return false;

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-refresh-qrcode", {
        body: {},
      });

      if (error || !data?.qrCode) return false;

      if (data.connected) {
        setQrCode(null);
        setPairingCode(null);
        stopRefresh();
        stopStatusPolling();
        isActiveRef.current = false;
        queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
        return false;
      }

      setQrCode(data.qrCode);
      return true;
    } catch {
      return false;
    }
  }, [stopRefresh, stopStatusPolling, queryClient]);

  const startQrRefresh = useCallback(() => {
    stopRefresh();
    refreshTimerRef.current = setInterval(async () => {
      await requestQrRefresh();
    }, QR_REFRESH_INTERVAL);
  }, [stopRefresh, requestQrRefresh]);

  const handleConnected = useCallback(() => {
    setQrCode(null);
    setPairingCode(null);
    stopRefresh();
    stopStatusPolling();
    isActiveRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
  }, [stopRefresh, stopStatusPolling, queryClient]);

  // Unified activation handler
  const handleActivate = async (phoneNumber?: string) => {
    const isPairingRequest = Boolean(phoneNumber);
    setIsActivating(true);
    setActivationError(null);

    if (isPairingRequest) {
      setQrCode(null);
      stopRefresh();
    } else {
      setPairingCode(null);
    }

    try {
      const body: Record<string, any> = {};
      if (phoneNumber) {
        body.phone_number = phoneNumber;
      }

      const { data, error } = await supabase.functions.invoke("whatsapp-activate-webhook", { body });
      
      if (error) throw error;

      if (data?.success === false) {
        const errCode = data.error?.code;
        const errMsg = data.error?.message || "Não foi possível ativar o WhatsApp";
        
        if (errCode === "EVOLUTION_INSTANCE_CONFLICT") {
          setActivationError({ code: errCode, message: errMsg });
          toast.error("Instância órfã na Evolution", {
            description: errMsg,
            duration: 6000
          });
          return;
        }

        const knownErrors = [
          "EVOLUTION_CREATE_FAILED",
          "EVOLUTION_CONNECT_FAILED",
          "EVOLUTION_QR_NOT_AVAILABLE",
          "EVOLUTION_UNAUTHORIZED",
          "MISSING_EVOLUTION_CONFIG",
          "MISSING_WEBHOOK_CONFIG"
        ];

        if (knownErrors.includes(errCode)) {
          toast.error(errMsg);
          return;
        }

        throw new Error(errMsg);
      }

      const isConnectedNow =
        data?.connected === true ||
        String(data?.status ?? "").trim().toLowerCase() === "connected";

      if (isConnectedNow) {
        handleConnected();
        toast.success("WhatsApp já está conectado!");
        return;
      }

      isActiveRef.current = true;
      startStatusPolling();

      await queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });

      // Pairing code response
      if (data?.pairingCode) {
        const code = data.pairingCode.replace(/-/g, "");
        setPairingCode(code);
        setQrCode(null);
        toast.success("Código de pareamento gerado! Insira no WhatsApp.");
        return;
      }

      if (isPairingRequest) {
        setQrCode(null);
        toast.info("Solicitação enviada. Aguarde alguns segundos e toque em Gerar novamente se o código ainda não aparecer.");
        return;
      }

      // QR code response
      startQrRefresh();
      if (data?.qrCode) {
        setQrCode(data.qrCode);
        setPairingCode(null);
        toast.success("QR Code gerado! Escaneie com o WhatsApp.");
      } else {
        const refreshedNow = await requestQrRefresh();
        if (refreshedNow) {
          toast.success("QR Code gerado! Escaneie com o WhatsApp.");
        } else {
          toast.success("Ativação enviada! Buscando QR Code automaticamente.");
        }
      }
    } catch (err: any) {
      toastError("Erro ao ativar WhatsApp", err instanceof Error ? err : new Error(String(err?.message || err)), { module: "WhatsAppIntegrationCard" });
    } finally {
      setIsActivating(false);
    }
  };

  const handleActivateQr = () => handleActivate();
  const handleActivatePairing = () => {
    const clean = phoneInput.replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error("Insira um número de telefone válido com DDD");
      return;
    }
    handleActivate(clean);
  };

  const handleCheckStatus = async () => {
    try {
      const result = await checkStatus();
      if (result?.status === "connected") {
        handleConnected();
        return;
      }
      if (result?.qr_code && connectionMode !== "pairing") {
        setQrCode(result.qr_code);
        startStatusPolling();
        return;
      }
      toast.info(connectionMode === "pairing"
        ? "Ainda aguardando a conexão pelo código de pareamento."
        : "Ainda sem QR Code disponível. Aguarde.");
    } catch { /* toast shown by hook */ }
  };

  const normalizeQrSrc = (value?: string | null) => {
    if (!value) return null;
    const t = value.trim();
    if (t.startsWith("data:image") || t.startsWith("http://") || t.startsWith("https://")) return t;
    return `data:image/png;base64,${t}`;
  };

  const displayedQr = connectionMode === "pairing"
    ? null
    : normalizeQrSrc(qrCode || instance?.qr_code || null);

  const statusBadge = () => {
    if (!instance) return null;
    switch (instance.status) {
      case "connected":
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>;
      case "connecting":
      case "provisioning":
        return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Conectando</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>;
    }
  };

  const isActuallyProvisioned = !!(
    instance?.instance_token || 
    instance?.phone_number || 
    instance?.instance_name || 
    instance?.status === "connected"
  );

  const shouldShowConnectionOptions = !instance || (
    !isActuallyProvisioned && 
    !displayedQr && 
    !pairingCode
  );

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length <= 13) {
      setPhoneInput(raw);
    }
  };

  // Connection mode selector (for initial activation or reconnection)
  const renderConnectionOptions = () => (
    <div className="space-y-4 w-full">
      {activationError?.code === "EVOLUTION_INSTANCE_CONFLICT" && (
        <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-md text-sm text-destructive animate-in fade-in slide-in-from-top-1">
          <p className="font-semibold flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4" /> Conflito na Evolution API
          </p>
          <p>
            Existe uma sessão antiga ou corrompida na Evolution. 
            Remova a instância no painel da Evolution ou use o botão <strong>Remover</strong> abaixo para limpar esta conexão local.
          </p>
        </div>
      )}

      <Tabs 
        value={connectionMode} 
        onValueChange={(v) => {
          setConnectionMode(v as "qr" | "pairing");
          setActivationError(null);
        }} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="qr" className="gap-1.5">
            <QrCode className="h-4 w-4" /> QR Code
          </TabsTrigger>
          <TabsTrigger value="pairing" className="gap-1.5">
            <Hash className="h-4 w-4" /> Código
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qr" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code com seu celular para conectar o WhatsApp.
          </p>
          <Button onClick={handleActivateQr} disabled={isActivating}>
            {isActivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
            {activationError?.code === "EVOLUTION_INSTANCE_CONFLICT" ? "Tentar novamente" : isActuallyProvisioned ? "Reconectar via QR" : "Conectar via QR Code"}
          </Button>
        </TabsContent>

      <TabsContent value="pairing" className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Insira seu número de telefone para receber um código de pareamento.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="+55 (11) 99999-9999"
            value={formatPhone(phoneInput)}
            onChange={handlePhoneChange}
            className="flex-1"
          />
          <Button onClick={handleActivatePairing} disabled={isActivating || phoneInput.replace(/\D/g, "").length < 10}>
            {isActivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hash className="h-4 w-4 mr-2" />}
            Gerar
          </Button>
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );

  // Pairing code display
  const renderPairingCode = () => {
    if (!pairingCode) return null;
    return (
      <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-background">
        <p className="text-sm font-medium">Insira este código no WhatsApp</p>
        <InputOTP maxLength={8} value={pairingCode} disabled>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
            <InputOTPSlot index={6} />
            <InputOTPSlot index={7} />
          </InputOTPGroup>
        </InputOTP>
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p className="font-medium">Como conectar:</p>
          <ol className="list-decimal list-inside text-left space-y-0.5">
            <li>Abra o WhatsApp no celular</li>
            <li>Vá em <strong>Dispositivos Conectados</strong></li>
            <li>Toque em <strong>Conectar Dispositivo</strong></li>
            <li>Escolha <strong>Conectar com número de telefone</strong></li>
            <li>Insira o código acima</li>
          </ol>
        </div>
        <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={isCheckingStatus}>
          {isCheckingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Verificar conexão
        </Button>
      </div>
    );
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
            <CardDescription>Integração via Evolution API — envie mensagens automáticas pelo CRM</CardDescription>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : !instance || (!instance.instance_token && !qrCode && !pairingCode) ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ative o WhatsApp para enviar mensagens automáticas diretamente do CRM.
              Este é um add-on cobrado separadamente.
            </p>
            {renderConnectionOptions()}
          </div>
        ) : (
          <div className="space-y-4">
            {instance && (
              <div className="grid gap-2 text-sm">
                {instance.instance_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Instância:</span>
                    <span className="font-medium">{instance.instance_name}</span>
                  </div>
                )}
                {instance.phone_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Número:</span>
                    <span className="font-medium">{instance.phone_number}</span>
                  </div>
                )}
              </div>
            )}

            {/* Pairing code display */}
            {pairingCode && instance?.status !== "connected" && renderPairingCode()}

            {/* QR Code display */}
            {displayedQr && !pairingCode && instance?.status !== "connected" && (
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

            {displayedQr && !instance && !pairingCode && (
              <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-background">
                <p className="text-sm font-medium">Escaneie o QR Code no WhatsApp</p>
                <img src={displayedQr} alt="QR Code WhatsApp" className="w-48 h-48" />
                <p className="text-xs text-muted-foreground">O QR Code é atualizado automaticamente a cada 45s</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {/* Reconnect — shown when disconnected */}
              {shouldShowConnectionOptions && renderConnectionOptions()}

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
                        <AlertDialogAction onClick={() => { deleteInstance(); setQrCode(null); setPairingCode(null); setActivationError(null); stopRefresh(); stopStatusPolling(); isActiveRef.current = false; }} disabled={isDeleting}>
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
