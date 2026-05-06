import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ScrollText, AlertTriangle, CheckCircle2, Clock, User, Mail, Phone, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAdWebhookLogs } from "@/hooks/useAdWebhookLogs";

export default function MetaWebhookLogsTab() {
  const { data: logs = [], isLoading } = useAdWebhookLogs();

  const getField = (fieldData: any[], fieldNames: string[]) => {
    if (!fieldData || !Array.isArray(fieldData)) return "";
    const field = fieldData.find(f => 
      fieldNames.some(name => f.name.toLowerCase().includes(name.toLowerCase()))
    );
    return field?.values?.[0] || "";
  };

  const getLeadInfo = (log: any) => {
    const payload = log.payload;
    if (!payload) return { name: "Lead Meta Ads", email: "", phone: "", adId: "" };

    const fieldData = payload.field_data || [];
    
    // Fallback for historical leads where name/email might be at top level
    const name = getField(fieldData, ["nome", "full_name", "name"]) || payload.name || "Lead Meta Ads";
    const email = getField(fieldData, ["email"]) || payload.email || "";
    const phone = getField(fieldData, ["telefone", "phone", "phone_number"]) || payload.phone || "";
    const adId = payload.ad_id || "";

    return { name, email, phone, adId };
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
            Histórico detalhado de cada lead recebido em tempo real.
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
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {logs.map((log) => {
                  const info = getLeadInfo(log);
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
                        {log.status === 'processed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 hidden sm:block" />
                        ) : log.status === 'error' ? (
                          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 hidden sm:block" />
                        ) : null}
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
    </div>
  );
}
