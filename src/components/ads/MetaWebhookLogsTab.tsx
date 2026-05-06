import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ScrollText, AlertTriangle, CheckCircle2, Clock, Mail, Phone, Tag, RotateCcw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdWebhookLogs, AdWebhookLog } from "@/hooks/useAdWebhookLogs";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
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

export default function MetaWebhookLogsTab() {
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useAdWebhookLogs();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reprocessWebhook = useMutation({
    mutationFn: async (logId: string) => {
      const targetLog = logs.find((log) => log.id === logId);
      if (!targetLog) throw new Error("Log não encontrado.");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-leadgen-webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "X-Meta-Reprocess-Log-Id": logId,
          },
          body: JSON.stringify(targetLog.payload),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }

      return response.text();
    },
    onSuccess: () => {
      toast.success("Lead reprocessado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ad-webhook-logs"] });
      queryClient.invalidateQueries({ queryKey: ["ad-leads"] });
      setConfirmOpen(false);
      setSelectedLogId(null);
    },
    onError: (e: any) => {
      toastError("Erro ao reprocessar lead", e, { module: "MetaWebhookLogsTab" });
      setConfirmOpen(false);
    },
  });

  const getField = (fieldData: any[], fieldNames: string[]) => {
    if (!fieldData || !Array.isArray(fieldData)) return "";
    const field = fieldData.find(f => 
      fieldNames.some(name => f.name.toLowerCase().includes(name.toLowerCase()))
    );
    return field?.values?.[0] || "";
  };

  const getLeadInfo = (log: AdWebhookLog) => {
    const payload = log.payload;
    if (!payload) return { name: "Lead Meta Ads", email: "", phone: "", adId: "" };

    const fieldData = payload.field_data || [];
    
    const name = getField(fieldData, ["nome", "full_name", "name"]) || payload.name || "Lead Meta Ads";
    const email = getField(fieldData, ["email"]) || payload.email || "";
    const phone = getField(fieldData, ["telefone", "phone", "phone_number"]) || payload.phone || "";
    const adId = payload.ad_id || "";

    return { name, email, phone, adId };
  };

  const selectedLog = selectedLogId ? logs.find(l => l.id === selectedLogId) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Logs de Sincronização Meta Ads
          </CardTitle>
          <CardDescription>
            Histórico detalhado de cada lead recebido. Clique em ressincronizar em caso de falha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Nenhum evento de webhook recebido ainda.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {logs.map((log) => {
                  const info = getLeadInfo(log);
                  const isCurrentLogPending = reprocessWebhook.isPending && selectedLogId === log.id;
                  
                  return (
                    <div key={log.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4 text-sm hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base truncate">{info.name}</span>
                            <Badge 
                              variant={
                                log.status === 'processed' ? 'default' : 
                                log.status === 'error' ? 'destructive' : 'secondary'
                              }
                              className="text-[10px] h-5"
                            >
                              {log.status === 'processed' ? 'Processado' : 
                               log.status === 'error' ? 'Erro' : 'Recebido'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                            </span>
                            {info.adId && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                ID Anúncio: {info.adId}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {log.status === 'error' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                setSelectedLogId(log.id);
                                setConfirmOpen(true);
                              }}
                              disabled={reprocessWebhook.isPending}
                            >
                              {isCurrentLogPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              Ressincronizar
                            </Button>
                          )}
                          {log.status === 'processed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                          ) : log.status === 'error' ? (
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/30 p-3 rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{info.email || "Sem e-mail"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span>{info.phone || "Sem telefone"}</span>
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                          <p className="text-xs text-destructive font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Erro no processamento:
                          </p>
                          <p className="text-xs text-destructive mt-1 italic">
                            {log.error_message}
                          </p>
                        </div>
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
            <AlertDialogTitle>Ressincronizar lead do Meta Ads?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Vou reprocessar as informações recebidas do Meta para tentar registrar esse lead novamente.
                </p>
                {selectedLog && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p><strong className="text-foreground">Lead:</strong> {getLeadInfo(selectedLog).name}</p>
                    <p><strong className="text-foreground">Recebido em:</strong> {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reprocessWebhook.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedLogId && reprocessWebhook.mutate(selectedLogId)} 
              disabled={reprocessWebhook.isPending}
            >
              {reprocessWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Confirmar ressincronização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
