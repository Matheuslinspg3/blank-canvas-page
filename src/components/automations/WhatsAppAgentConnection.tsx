import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { Loader2, MessageCircle, CheckCircle2, XCircle, RefreshCw, Smartphone, QrCode, Hash, Trash2 } from "lucide-react";
import { useWhatsAppV2 } from "@/hooks/useWhatsAppV2";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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

export function WhatsAppAgentConnection() {
  const {
    connection,
    status,
    isLoading,
    connect,
    isConnecting,
    deleteConnection,
    isDeleting,
    refetch,
    error
  } = useWhatsAppV2();
  
  const { profile } = useAuth();
  const [phoneInput, setPhoneInput] = useState("");
  const [connectionMode, setConnectionMode] = useState<"qr" | "pairing">("qr");

  // Format phone number for display
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const handleActivate = () => {
    if (!phoneInput || phoneInput.length < 10) {
      toast.error("Por favor, informe um número de celular válido com DDD.");
      return;
    }
    connect({ mode: connectionMode, phoneNumber: phoneInput });
  };

  const displayedQr = connection?.qr_code;


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
    <Card className="border-primary/10 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold font-display">Conexão do Agente de IA</CardTitle>
            <CardDescription>O Agente de IA usará este WhatsApp para enviar mensagens</CardDescription>
          </div>
          {status === "connected" && (
            <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">
              Conectado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "connected" ? (
          <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">WhatsApp conectado com sucesso!</p>
              <p className="text-xs text-muted-foreground mt-1">Número: {connection?.phone_number}</p>
            </div>
            <div className="flex gap-2 w-full mt-2">
              <Button variant="outline" className="flex-1" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Status
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
                      Isso desconectará o seu WhatsApp do sistema. Você precisará escanear o QR Code novamente para reativar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteConnection()} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            {error && (
              <div className="p-3 border border-destructive/20 bg-destructive/5 rounded-lg text-xs text-destructive flex gap-2 items-start">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Erro na conexão</p>
                  <p>{error.message}</p>
                </div>
              </div>
            )}

            {!displayedQr && !connection?.pairing_code && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Seu número de celular</label>
                <Input 
                  placeholder="+55 (11) 99999-9999" 
                  value={formatPhone(phoneInput)} 
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ""))}
                  disabled={isConnecting}
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Informe o número que será conectado (com DDD).</p>
              </div>
            )}

            {!displayedQr && !connection?.pairing_code ? (
              <Button 
                className="w-full" 
                onClick={handleActivate} 
                disabled={isConnecting || phoneInput.length < 10}
              >
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Smartphone className="h-4 w-4 mr-2" />}
                Gerar QR Code e Código de Pareamento
              </Button>
            ) : (
              <div className="space-y-4">
                {displayedQr && (
                  <div className="flex flex-col items-center gap-3 py-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <QrCode className="h-3 w-3" /> Escaneie o QR Code
                    </div>
                    <div className="p-3 border-2 border-primary/20 rounded-xl bg-white shadow-inner">
                      <img src={displayedQr} alt="WhatsApp QR Code" className="h-44 w-44" />
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground px-4">
                      WhatsApp {'>'} Configurações {'>'} Dispositivos Conectados {'>'} Conectar um Dispositivo
                    </p>
                  </div>
                )}

                {connection?.pairing_code && (
                  <div className="flex flex-col items-center gap-3 py-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Hash className="h-3 w-3" /> Ou use o Código de Pareamento
                    </div>
                    <div className="text-3xl font-mono font-bold tracking-[0.2em] px-5 py-3 border-2 border-primary/20 rounded-xl bg-white shadow-inner text-primary">
                      {connection.pairing_code}
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground px-4">
                      WhatsApp {'>'} Dispositivos Conectados {'>'} Conectar com número de telefone
                    </p>
                  </div>
                )}

                <Button variant="outline" size="sm" className="w-full" onClick={() => refetch()} disabled={isLoading || isConnecting}>
                  <RefreshCw className="h-3 w-3 mr-2" /> Atualizar / Verificar Status
                </Button>
              </div>
            )}

            {(displayedQr || connection?.pairing_code) && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-destructive hover:bg-destructive/5" 
                onClick={() => deleteConnection()}
                disabled={isDeleting}
              >
                Limpar Tentativa e Recomeçar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
