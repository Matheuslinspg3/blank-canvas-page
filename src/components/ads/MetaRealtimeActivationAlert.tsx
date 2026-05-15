import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function MetaRealtimeActivationAlert() {
  const [isActivating, setIsActivating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { toast } = useToast();

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-resubscribe-leadgen", {
        body: {},
      });

      if (error) throw error;

      if (data?.needs_reconnect) {
        toast({
          title: "Ação necessária",
          description: "É necessário reconectar sua conta Meta para conceder permissões de gerenciamento de páginas.",
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Sucesso!",
          description: `Sincronização ativada para ${data.subscribed} páginas.`,
        });
        setIsDone(true);
      } else {
        toast({
          title: "Aviso",
          description: "Não foi possível ativar em todas as páginas. Tente reconectar a conta.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error activating real-time:", err);
      toast({
        title: "Erro",
        description: "Falha ao ativar sincronização em tempo real.",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  if (isDone) return null;

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Zap className="h-4 w-4 text-primary" />
      <AlertTitle>Ativar Sincronização em Tempo Real</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Para garantir que os leads do Meta Ads cheguem instantaneamente, suas páginas precisam estar inscritas em nosso sistema de notificações.
        </p>
        <Button 
          size="sm" 
          onClick={handleActivate} 
          disabled={isActivating}
          className="gap-2"
        >
          {isActivating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          Ativar tempo real
        </Button>
      </AlertDescription>
    </Alert>
  );
}
