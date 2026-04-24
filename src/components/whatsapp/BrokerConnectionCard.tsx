import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Smartphone, Wifi, WifiOff, Loader2, QrCode, Trash2, RefreshCw, KeyRound, Copy } from "lucide-react";
import { useBrokerChannel } from "@/hooks/whatsapp/useBrokerChannel";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Wifi }> = {
  connected: { label: "Conectado", variant: "default", icon: Wifi },
  connecting: { label: "Conectando...", variant: "secondary", icon: Loader2 },
  disconnected: { label: "Desconectado", variant: "destructive", icon: WifiOff },
};

export function BrokerConnectionCard() {
  const {
    status, phone, qrCode, isLoading, pairingCode,
    connect, disconnect, deleteInstance,
    isConnecting, isDisconnecting, refetch,
  } = useBrokerChannel();

  const [mode, setMode] = useState<"qr" | "pairing">("qr");
  const [phoneInput, setPhoneInput] = useState("");

  const cfg = statusConfig[status] ?? statusConfig.disconnected;
  const StatusIcon = cfg.icon;

  const handleGeneratePairing = () => {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe o número completo com DDD (ex: 5511999998888)");
      return;
    }
    connect({ phoneNumber: digits } as any);
  };

  const copyPairing = async () => {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(pairingCode);
    toast.success("Código copiado");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Meu WhatsApp</CardTitle>
              <CardDescription>Conecte seu número pessoal ao sistema</CardDescription>
            </div>
          </div>
          <Badge variant={cfg.variant} className="gap-1.5">
            <StatusIcon className={`h-3 w-3 ${status === "connecting" ? "animate-spin" : ""}`} />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connected phone */}
        {status === "connected" && phone && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              +{phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4")}
            </span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Connection modes (when not connected) */}
        {status !== "connected" && !isLoading && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "qr" | "pairing")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="qr" className="gap-1.5">
                <QrCode className="h-3.5 w-3.5" /> QR Code
              </TabsTrigger>
              <TabsTrigger value="pairing" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Código
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="space-y-3 pt-3">
              {status === "connecting" && qrCode ? (
                <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground text-center">
                    Escaneie o QR Code com seu WhatsApp
                  </p>
                  <div className="bg-white p-3 rounded-lg">
                    <img
                      src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code WhatsApp"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Atualizar QR Code
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => connect()}
                  disabled={isConnecting}
                  className="w-full gap-2"
                >
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Gerar QR Code
                </Button>
              )}
            </TabsContent>

            <TabsContent value="pairing" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label htmlFor="broker-phone" className="text-xs">
                  Número completo com DDI e DDD
                </Label>
                <Input
                  id="broker-phone"
                  placeholder="5511999998888"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  inputMode="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Ex: 55 (Brasil) + 11 (DDD) + número
                </p>
              </div>

              {pairingCode ? (
                <div className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground text-center">
                    Digite este código no WhatsApp em <strong>Aparelhos conectados → Conectar com número</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold tracking-widest bg-background px-4 py-2 rounded border">
                      {pairingCode}
                    </code>
                    <Button variant="ghost" size="icon" onClick={copyPairing}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleGeneratePairing} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar novo código
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGeneratePairing}
                  disabled={isConnecting || phoneInput.replace(/\D/g, "").length < 10}
                  className="w-full gap-2"
                >
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Gerar código de 8 dígitos
                </Button>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Disconnect / delete actions */}
        {(status === "connected" || status === "connecting") && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => disconnect(undefined)}
              disabled={isDisconnecting}
              className="flex-1 gap-2"
            >
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
              Desconectar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteInstance(undefined)}
              className="text-destructive hover:text-destructive"
              title="Remover instância"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
