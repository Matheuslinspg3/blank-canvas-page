import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ScrollText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdWebhookLogs } from "@/hooks/useAdWebhookLogs";

export default function MetaWebhookLogsTab() {
  const { data: logs = [], isLoading } = useAdWebhookLogs();

  const getLeadLabel = (payload: any) => {
    if (!payload) return "Evento Meta Ads";
    return payload.leadgen_id ? `Lead ID: ${payload.leadgen_id}` : "Evento Meta Ads";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Logs de Sincronização Meta Ads
          </CardTitle>
          <CardDescription>
            Histórico em tempo real de cada lead que chega do Meta Ads via Webhook.
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
              <p className="text-xs text-muted-foreground mt-1">Os leads aparecerão aqui assim que forem gerados nos seus anúncios.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium flex items-center gap-2">
                          {getLeadLabel(log.payload)}
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
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                      {log.status === 'processed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : log.status === 'error' ? (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      ) : null}
                    </div>

                    <div className="bg-muted/50 rounded p-2 text-[10px] font-mono overflow-x-auto">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>

                    {log.error_message && (
                      <p className="text-xs text-destructive border-t border-destructive/20 pt-2 mt-1">
                        <strong>Erro:</strong> {log.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
