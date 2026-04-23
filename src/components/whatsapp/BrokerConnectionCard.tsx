import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Wifi, WifiOff, Loader2, QrCode, Trash2, RefreshCw } from "lucide-react";
import { useBrokerChannel } from "@/hooks/whatsapp/useBrokerChannel";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Wifi }> = {
  connected: { label: "Conectado", variant: "default", icon: Wifi },
  connecting: { label: "Conectando...", variant: "secondary", icon: Loader2 },
  disconnected: { label: "Desconectado", variant: "destructive", icon: WifiOff },
};

export function BrokerConnectionCard() {
  const {
    status, phone, qrCode, isLoading,
    connect, disconnect, deleteInstance,
    isConnecting, isDisconnecting, refetch,
  } = useBrokerChannel();

  const cfg = statusConfig[status] ?? statusConfig.disconnected;
  const StatusIcon = cfg.icon;

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
        {/* QR Code */}
        {status === "connecting" && qrCode && (
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
        )}

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

        {/* Actions */}
        <div className="flex gap-2">
          {status === "disconnected" && (
            <Button
              onClick={() => connect()}
              disabled={isConnecting}
              className="flex-1 gap-2"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Conectar WhatsApp
            </Button>
          )}

          {status === "connecting" && !qrCode && (
            <Button
              onClick={() => connect()}
              disabled={isConnecting}
              variant="outline"
              className="flex-1 gap-2"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Gerar QR Code
            </Button>
          )}

          {(status === "connected" || status === "connecting") && (
            <>
              <Button
                variant="outline"
                onClick={() => disconnect()}
                disabled={isDisconnecting}
                className="gap-2"
              >
                {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                Desconectar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteInstance()}
                className="text-destructive hover:text-destructive"
                title="Remover instância"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
