import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageCircle, CheckCircle2, XCircle, RefreshCw, Smartphone, QrCode, Hash, Trash2 } from "lucide-react";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";
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
  const [activationError, setActivationError] = useState<{ code: string; message: string; debug_ref?: string } | null>(null);
  const [connectionMode, setConnectionMode] = useState<"qr" | "pairing">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const isActiveRef = useRef(false);
  const statusPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStatusPolling = useCallback(() => {
    if (statusPollingRef.current) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }
  }, []);

  useEffect(() => () => { stopStatusPolling(); }, [stopStatusPolling]);

  const handleConnected = useCallback(() => {
    setQrCode(null);
    setPairingCode(null);
    stopStatusPolling();
    isActiveRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
  }, [stopStatusPolling, queryClient]);

  const startStatusPolling = useCallback(() => {
    stopStatusPolling();
    statusPollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("whatsapp-instance", {
          body: { action: "status" },
        });
        if (data?.status === "connected") {
          handleConnected();
          toast.success("WhatsApp conectado com sucesso!");
        }
      } catch { /* silent */ }
    }, STATUS_POLL_INTERVAL);
  }, [handleConnected, stopStatusPolling]);

  const handleActivate = async (phoneNumber?: string) => {
    if (isActivating) return;
    
    const mode = phoneNumber ? "pairing" : "qr";
    setIsActivating(true);
    setActivationError(null);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-activate-webhook", {
        body: { phone_number: phoneNumber },
      });

      if (error) {
        const status = error?.context?.status;
        let payload: { code?: string; message?: string; debug_ref?: string } | null = null;
        try { 
            const response = error.context;
            if (response && response.clone) {
                payload = await response.clone().json();
            }
        } catch { /* ignore */ }
        
        const code = payload?.code || "ACTIVATE_ERROR";
        const message = payload?.message || "Erro ao ativar conexão";
        const debug_ref = payload?.debug_ref;

        setActivationError({ code, message, debug_ref });
        
        Sentry.captureException(error, {
          tags: {
            function_name: "whatsapp-activate-webhook",
            route: "/automacoes",
            activation_mode: mode,
            error_code: code,
            http_status: status,
          },
          extra: { debug_ref, org_id: instance?.organization_id }
        });

        toast.error(message, { description: debug_ref });
        return;
      }

      if (data?.ok === false) {
          setActivationError(data);
          toast.error(data.message, { description: data.debug_ref });
          return;
      }

      if (data?.status === "connected") {
        handleConnected();
        toast.success("WhatsApp já está conectado!");
        return;
      }

      if (data?.pairingCode) {
        setPairingCode(data.pairingCode);
        setQrCode(null);
        toast.success("Código de pareamento gerado!");
      } else if (data?.qrCode) {
        setQrCode(data.qrCode);
        setPairingCode(null);
        toast.success("QR Code gerado!");
      }

      isActiveRef.current = true;
      startStatusPolling();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });

    } catch (err: unknown) {
      toast.error("Falha na requisição");
      Sentry.captureException(err);
    } finally {
      setIsActivating(false);
    }
  };

  const isActuallyProvisioned = !!(instance?.instance_token || instance?.instance_name);

  const normalizeQrSrc = (value?: string | null) => {
    if (!value) return null;
    const t = value.trim();
    if (t.startsWith("data:image") || t.startsWith("http")) return t;
    return `data:image/png;base64,${t}`;
  };

  const displayedQr = normalizeQrSrc(qrCode || instance?.qr_code);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  if (isLoading) {
      return (
          <Card>
              <CardContent className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
          </Card>
      );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">WhatsApp</CardTitle>
            <CardDescription>Integração via Evolution API</CardDescription>
          </div>
          {instance && (
            <Badge variant={instance.status === "connected" ? "default" : "outline"}>
              {instance.status === "connected" ? "Conectado" : "Desconectado"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {instance?.status === "connected" ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 rounded-full bg-green-50 text-green-600">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <p className="text-center text-sm font-medium">Sua conta está conectada e pronta para uso.</p>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => disconnectInstance()} disabled={isDisconnecting}>
                {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desconectar"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1" disabled={isDeleting}>
                     {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                     Remover
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover integração?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso excluirá permanentemente a instância na Evolution API e limpará os dados locais.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteInstance()} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <>
            {activationError?.code === "EVOLUTION_INSTANCE_CONFLICT" && (
              <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-md text-sm text-destructive">
                <p className="font-semibold flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4" /> Conflito na Evolution API
                </p>
                <p>Existe uma sessão órfã. Tente remover a integração para limpar o estado.</p>
                <Button variant="outline" size="sm" className="mt-2 text-destructive border-destructive/20" onClick={() => deleteInstance()} disabled={isDeleting}>
                    Limpar localmente
                </Button>
              </div>
            )}

            <Tabs value={connectionMode} onValueChange={(v) => setConnectionMode(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr" className="gap-2"><QrCode className="h-4 w-4" /> QR Code</TabsTrigger>
                <TabsTrigger value="pairing" className="gap-2"><Hash className="h-4 w-4" /> Código</TabsTrigger>
              </TabsList>
              
              <TabsContent value="qr" className="space-y-4 pt-4">
                {displayedQr ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-2 border rounded-lg bg-white">
                      <img src={displayedQr} alt="WhatsApp QR Code" className="h-48 w-48" />
                    </div>
                    <Button variant="outline" onClick={() => handleActivate()} disabled={isActivating}>
                      {isActivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Atualizar QR Code
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full" onClick={() => handleActivate()} disabled={isActivating}>
                    {isActivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
                    {isActuallyProvisioned ? "Reconectar via QR" : "Conectar WhatsApp"}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="pairing" className="space-y-4 pt-4">
                {pairingCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-sm font-medium">Insira este código no WhatsApp:</p>
                    <div className="text-3xl font-mono font-bold tracking-widest p-4 border rounded bg-muted">
                        {pairingCode}
                    </div>
                    <Button variant="outline" onClick={() => checkStatus()} disabled={isCheckingStatus}>
                        {isCheckingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Verificar Status
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input 
                        placeholder="+55 (11) 99999-9999" 
                        value={formatPhone(phoneInput)} 
                        onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                    />
                    <Button className="w-full" onClick={() => handleActivate(phoneInput)} disabled={isActivating || phoneInput.length < 10}>
                      {isActivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hash className="h-4 w-4 mr-2" />}
                      Gerar Código
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            {!displayedQr && !pairingCode && isActuallyProvisioned && (
                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => checkStatus()} disabled={isCheckingStatus}>
                        {isCheckingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar Status"}
                    </Button>
                     <Button variant="ghost" className="flex-1 text-destructive" onClick={() => deleteInstance()} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
                    </Button>
                </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
