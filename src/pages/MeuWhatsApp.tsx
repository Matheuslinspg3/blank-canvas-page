import { useState } from "react";
import { useWhatsAppV2 } from "@/hooks/useWhatsAppV2";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, QrCode, Phone, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function MeuWhatsApp() {
  const { connection, status, isLoading, connect, isConnecting, deleteConnection, isDeleting, refetch } = useWhatsAppV2();
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleConnect = (mode: "qr" | "pairing") => {
    connect({ mode, phoneNumber: mode === "pairing" ? phoneNumber : undefined });
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-10 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-10 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu WhatsApp v2</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sua conexão oficial de WhatsApp para automações e CRM.
          </p>
        </div>
        {status !== "not_configured" && (
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Verificar status
          </Button>
        )}
      </div>

      {status === "not_configured" && (
        <Card className="border-2 border-dashed border-muted">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Conecte seu WhatsApp</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Use seu WhatsApp Business para atender leads, receber mensagens e ativar automações dentro do Porta do Corretor.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Tabs defaultValue="qr" className="w-full max-w-sm mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="pairing">Código de Pareamento</TabsTrigger>
              </TabsList>
              <TabsContent value="qr" className="mt-6">
                <Button className="w-full" size="lg" onClick={() => handleConnect("qr")} disabled={isConnecting}>
                  {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                  Gerar QR Code
                </Button>
              </TabsContent>
              <TabsContent value="pairing" className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Número com DDI (Ex: 5511999999999)</Label>
                  <Input 
                    id="phone" 
                    placeholder="5511999999999" 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)} 
                  />
                </div>
                <Button className="w-full" size="lg" onClick={() => handleConnect("pairing")} disabled={isConnecting || !phoneNumber}>
                  {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                  Gerar Código de Pareamento
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {(status === "qr_pending" || status === "provisioning") && (
        <Card className="border-primary/50">
          <CardHeader className="text-center">
            <CardTitle>Escaneie o QR Code</CardTitle>
            <CardDescription>
              Abra o WhatsApp no celular, vá em Dispositivos conectados e escaneie o código para conectar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6">
            {connection?.qr_code ? (
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <img src={connection.qr_code} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted animate-pulse rounded-xl flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col items-center space-y-2">
              <span className="text-sm font-medium flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Aguardando leitura do QR Code...
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleConnect("qr")} disabled={isConnecting}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar QR
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteConnection()} className="text-destructive">
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "pairing_pending" && (
        <Card className="border-primary/50">
          <CardHeader className="text-center">
            <CardTitle>Código de Pareamento</CardTitle>
            <CardDescription>
              Use este código no WhatsApp para conectar sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-8">
            <div className="text-5xl font-mono font-bold tracking-[0.5em] bg-muted px-8 py-6 rounded-lg border">
              {connection?.pairing_code || "-------"}
            </div>
            <div className="flex flex-col items-center space-y-4">
              <span className="text-sm font-medium flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Aguardando confirmação no celular...
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleConnect("pairing")} disabled={isConnecting}>
                  Gerar novo código
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteConnection()} className="text-destructive">
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "connected" && (
        <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl text-green-800 dark:text-green-400">WhatsApp Conectado</CardTitle>
                <CardDescription>Seu WhatsApp está pronto para receber leads e mensagens.</CardDescription>
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-md mt-6 text-sm">
                <div className="bg-card p-3 rounded-lg border text-left">
                  <p className="text-muted-foreground mb-1">Status</p>
                  <p className="font-semibold flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                    Conectado
                  </p>
                </div>
                <div className="bg-card p-3 rounded-lg border text-left">
                  <p className="text-muted-foreground mb-1">Número</p>
                  <p className="font-semibold">{connection?.phone_number || "Desconhecido"}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => deleteConnection()} disabled={isDeleting}>
                  <XCircle className="h-4 w-4 mr-2" /> Desconectar
                </Button>
                <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => deleteConnection()} disabled={isDeleting}>
                   <Trash2 className="h-4 w-4 mr-2" /> Remover Integração
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(status === "disconnected" || status === "error") && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg">Conexão interrompida</AlertTitle>
          <AlertDescription className="mt-2 space-y-4">
            <p>
              Sua sessão do WhatsApp foi encerrada ou perdeu conexão. Reconecte para continuar usando mensagens e automações.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => handleConnect("qr")}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reconectar WhatsApp
              </Button>
              <Button variant="outline" onClick={() => deleteConnection()}>
                Remover conexão
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
