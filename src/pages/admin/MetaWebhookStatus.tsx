import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, RotateCcw, Webhook, Facebook, Activity, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

interface StatusResponse {
  account: {
    id: string;
    name: string;
    external_account_id: string;
    status: string;
    meta_realtime: { status: string; pages_checked: number; subscribed: number; failed: number; checked_at: string } | null;
    updated_at: string;
  } | null;
  pages: Array<{ id: string; name: string; leadgen_subscribed: boolean; app_name: string | null; error: string | null }>;
  meta_error: { code?: number; message?: string } | null;
  needs_reconnect: boolean;
  stats_7d: { total: number; processed: number; errors: number; received: number };
  last_received_at: string | null;
  recent_logs: Array<any>;
  open_failures: Array<any>;
  checked_at: string;
}

async function fetchStatus(): Promise<StatusResponse> {
  const { data, error } = await supabase.functions.invoke("meta-webhook-status");
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as StatusResponse;
}

export default function MetaWebhookStatus() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["meta-webhook-status"],
    queryFn: fetchStatus,
    refetchInterval: 30000,
  });

  const resubscribe = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-resubscribe-leadgen", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(`Re-inscrição: ${res?.subscribed ?? 0} páginas OK, ${res?.failed ?? 0} falhas`);
      qc.invalidateQueries({ queryKey: ["meta-webhook-status"] });
    },
    onError: (e) => toastError("Falha ao re-inscrever páginas", e, { module: "MetaWebhookStatus" }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Status Webhook Meta Ads" description="Carregando..." />
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const subscribedPages = data?.pages.filter(p => p.leadgen_subscribed).length ?? 0;
  const totalPages = data?.pages.length ?? 0;
  const lastReceived = data?.last_received_at ? new Date(data.last_received_at) : null;
  const hoursSinceLast = lastReceived ? (Date.now() - lastReceived.getTime()) / 3600000 : null;
  const webhookHealthy = hoursSinceLast !== null && hoursSinceLast < 24;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Status Webhook Meta Ads"
        description="Monitoramento em tempo real da subscription leadgen e entregas"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Top status cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatusCard
            icon={<Webhook className="h-5 w-5" />}
            label="Última entrega"
            value={lastReceived ? formatDistanceToNow(lastReceived, { locale: ptBR, addSuffix: true }) : "Nunca"}
            tone={webhookHealthy ? "success" : "warning"}
            sub={lastReceived ? format(lastReceived, "dd/MM HH:mm", { locale: ptBR }) : "—"}
          />
          <StatusCard
            icon={<Facebook className="h-5 w-5" />}
            label="Pages inscritas (leadgen)"
            value={`${subscribedPages}/${totalPages}`}
            tone={subscribedPages > 0 ? "success" : "danger"}
            sub={data?.needs_reconnect ? "Reconexão necessária" : "Subscription ativa"}
          />
          <StatusCard
            icon={<Activity className="h-5 w-5" />}
            label="Eventos (7 dias)"
            value={String(data?.stats_7d.total ?? 0)}
            tone="neutral"
            sub={`${data?.stats_7d.processed ?? 0} processados`}
          />
          <StatusCard
            icon={<AlertCircle className="h-5 w-5" />}
            label="Erros (7 dias)"
            value={String(data?.stats_7d.errors ?? 0)}
            tone={(data?.stats_7d.errors ?? 0) > 0 ? "danger" : "success"}
            sub={`${data?.open_failures.length ?? 0} falhas abertas`}
          />
        </div>

        {/* Account / Re-subscribe */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                Conta Meta Ads
              </CardTitle>
              <CardDescription>
                {data?.account
                  ? `${data.account.name} (${data.account.external_account_id}) — status: ${data.account.status}`
                  : "Nenhuma conta Meta conectada"}
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => resubscribe.mutate()}
              disabled={resubscribe.isPending || !data?.account}
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${resubscribe.isPending ? "animate-spin" : ""}`} />
              Reinscrever páginas
            </Button>
          </CardHeader>
          <CardContent>
            {data?.meta_error && (
              <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive">
                <strong>Erro Meta API:</strong> {data.meta_error.message} {data.meta_error.code && `(code ${data.meta_error.code})`}
                {data.needs_reconnect && (
                  <p className="mt-1">Token expirado/permissões revogadas. Reconecte a conta em Marketing → Configurações.</p>
                )}
              </div>
            )}

            {data?.account?.meta_realtime && (
              <p className="text-xs text-muted-foreground mb-3">
                Última verificação de subscription: {format(new Date(data.account.meta_realtime.checked_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            )}

            <div className="space-y-2">
              {data?.pages.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma Page disponível para esta conta.</p>
              )}
              {data?.pages.map(p => (
                <div key={p.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {p.id}{p.app_name && ` • App: ${p.app_name}`}</p>
                    {p.error && <p className="text-xs text-destructive mt-1">{p.error}</p>}
                  </div>
                  <Badge variant={p.leadgen_subscribed ? "default" : "destructive"} className="shrink-0">
                    {p.leadgen_subscribed ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Inscrita</>
                    ) : (
                      <><AlertTriangle className="h-3 w-3 mr-1" /> Sem leadgen</>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Logs / Failures */}
        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Entregas recentes</TabsTrigger>
            <TabsTrigger value="failures">Falhas em aberto ({data?.open_failures.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas 50 entregas do webhook (7 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.recent_logs.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento recebido nos últimos 7 dias.</p>
                ) : (
                  <ScrollArea className="h-[420px] pr-3">
                    <div className="space-y-2">
                      {data?.recent_logs.map(log => (
                        <div key={log.id} className="flex items-start justify-between gap-3 border rounded-md p-3 text-xs hover:bg-muted/30">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={log.status === "processed" ? "default" : log.status === "error" ? "destructive" : "secondary"} className="text-[10px] h-5">
                                {log.status}
                              </Badge>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                              </span>
                              {log.external_lead_id && <span className="text-muted-foreground">Lead: {log.external_lead_id}</span>}
                            </div>
                            {log.error_message && (
                              <p className="text-destructive mt-1 italic">{log.error_message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failures">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Falhas de lead (não resolvidas)</CardTitle>
                <CardDescription>Eventos que não conseguiram criar lead após múltiplas tentativas</CardDescription>
              </CardHeader>
              <CardContent>
                {(data?.open_failures.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Sem falhas em aberto 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {data?.open_failures.map(f => (
                      <div key={f.id} className="border rounded-md p-3 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-medium">Lead {f.leadgen_id}</span>
                          <Badge variant="destructive" className="text-[10px] h-5">
                            {f.attempt_count} tentativas
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1">Page: {f.page_id} • Form: {f.form_id}</p>
                        <p className="text-destructive mt-1 italic">{f.reason}</p>
                        <p className="text-muted-foreground mt-1">{format(new Date(f.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center">
          Atualiza automaticamente a cada 30 segundos • Última verificação: {data?.checked_at && format(new Date(data.checked_at), "HH:mm:ss", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const toneClass = {
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-destructive",
    neutral: "text-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
        <p className={`text-2xl font-semibold mt-2 ${toneClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
