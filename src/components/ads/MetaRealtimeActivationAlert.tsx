import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdAccount } from "@/hooks/useAdSettings";

export default function MetaRealtimeActivationAlert() {
  const { account } = useAdAccount();
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<"unknown" | "checking" | "enabled" | "attention" | "needs_reconnect">("unknown");
  const { toast } = useToast();

  const realtimeStatus = (account as any)?.auth_payload?.meta_realtime?.status;

  useEffect(() => {
    if (realtimeStatus) {
      setStatus(realtimeStatus);
    } else if (account) {
      // If no status but connected, attempt silent check once
      handleCheckSilently();
    }
  }, [realtimeStatus, account]);

  const handleCheckSilently = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setStatus("checking");
    
    try {
      const { data, error } = await supabase.functions.invoke("meta-resubscribe-leadgen", {
        body: {},
      });

      if (error) throw error;
      
      if (data?.realtime_status) {
        setStatus(data.realtime_status);
      }
    } catch (err) {
      console.error("Silent realtime check failed:", err);
      setStatus("attention");
    } finally {
      setIsChecking(false);
    }
  };

  const handleReconnect = async () => {
    // This is handled by the parent component or by re-triggering OAuth
    // We emit a click to the connect button if we had a ref, but here we just show the message
    toast({
      title: "Reconexão necessária",
      description: "Por favor, clique em 'Conectar com Meta' novamente para atualizar suas permissões.",
    });
  };

  if (status === "enabled" || status === "unknown") {
    if (status === "enabled") {
      return (
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 w-fit">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Leads automáticos ativos
        </div>
      );
    }
    return null;
  }

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Verificando sincronização automática...
      </div>
    );
  }

  if (status === "needs_reconnect" || status === "attention") {
    return (
      <Alert variant={status === "needs_reconnect" ? "destructive" : "default"} className={cn(
        status === "needs_reconnect" ? "bg-destructive/5 border-destructive/20" : "bg-amber-50 border-amber-200"
      )}>
        {status === "needs_reconnect" ? <AlertCircle className="h-4 w-4" /> : <Zap className="h-4 w-4 text-amber-600" />}
        <AlertTitle>{status === "needs_reconnect" ? "Reconexão necessária" : "Sincronização automática desativada"}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            {status === "needs_reconnect" 
              ? "Não conseguimos confirmar a inscrição das suas páginas no webhook do Meta. Reconecte sua conta Meta para liberar a sincronização automática de leads."
              : "A sincronização em tempo real (webhook) não está ativa para suas páginas. Isso significa que os leads não entrarão automaticamente."}
          </p>
          <div className="flex gap-2">
            {status === "attention" && (
              <Button 
                variant="outline"
                size="sm" 
                onClick={handleCheckSilently}
                disabled={isChecking}
              >
                {isChecking ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Zap className="mr-2 h-3 w-3" />}
                Ativar agora
              </Button>
            )}
            <Button 
              variant="outline"
              size="sm" 
              onClick={() => window.location.reload()} 
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              {status === "needs_reconnect" ? "Recarregar para reconectar" : "Recarregar página"}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
