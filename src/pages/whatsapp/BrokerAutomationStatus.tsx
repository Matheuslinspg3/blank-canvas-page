import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RotateCcw, Ban, Play, Clock, CheckCircle2, XCircle, MessageSquare, History, BarChart3, Zap, Timer, CalendarClock } from "lucide-react";
import { useBrokerFollowUpQueue } from "@/hooks/whatsapp/useBrokerFollowUpQueue";
import { useBrokerAutomation } from "@/hooks/whatsapp/useBrokerAutomation";
import { useMemo } from "react";

// Calcula o próximo disparo do cron (a cada 15 min)
function getNextCronFire() {
  const now = new Date();
  const mins = now.getMinutes();
  const next = new Date(now);
  const nextMin = Math.ceil((mins + 1) / 15) * 15;
  if (nextMin >= 60) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
  } else {
    next.setMinutes(nextMin);
  }
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "default" },
  completed: { label: "Concluído", variant: "secondary" },
  responded: { label: "Respondeu", variant: "outline" },
  opted_out: { label: "Opt-out", variant: "destructive" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

export default function BrokerAutomationStatus() {
  const { queue, logs, isLoading, optOut, reactivate } = useBrokerFollowUpQueue();
  const { config } = useBrokerAutomation();

  const stats = useMemo(() => {
    const total = queue.length;
    const pending = queue.filter((q) => q.status === "pending").length;
    const responded = queue.filter((q) => q.status === "responded").length;
    const completed = queue.filter((q) => q.status === "completed").length;
    const optedOut = queue.filter((q) => q.opted_out).length;
    return { total, pending, responded, completed, optedOut };
  }, [queue]);

  return (
    <>
      <Helmet>
        <title>Automações WhatsApp — Porta do Corretor</title>
        <meta name="description" content="Visualize status e histórico das automações do seu canal WhatsApp." />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Automações WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Monitore follow-ups, histórico de envios e gerencie opt-outs do seu canal.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Total na fila" value={stats.total} />
          <StatCard icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="Pendentes" value={stats.pending} />
          <StatCard icon={<MessageSquare className="h-4 w-4 text-primary" />} label="Responderam" value={stats.responded} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4 text-primary" />} label="Concluídos" value={stats.completed} />
          <StatCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Opt-out" value={stats.optedOut} />
        </div>

        {/* Config summary */}
        {config && (
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Saudação:</span>
                  <Badge variant={config.greeting_enabled ? "default" : "secondary"}>
                    {config.greeting_enabled ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Follow-up:</span>
                  <Badge variant={config.followup_enabled ? "default" : "secondary"}>
                    {config.followup_enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {config.followup_enabled && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {config.followup_max_attempts} tentativas • Intervalos: {config.followup_intervals.join("h, ")}h
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Horário: {config.followup_business_hours.start}–{config.followup_business_hours.end}
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Fila de Follow-up
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico de Envios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fila de Follow-up</CardTitle>
                <CardDescription>Leads na fila do seu canal broker</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : queue.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum lead na fila de follow-up ainda. Quando alguém enviar uma mensagem ao seu WhatsApp, aparecerá aqui.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Tentativas</TableHead>
                          <TableHead>Próximo envio</TableHead>
                          <TableHead>Último envio</TableHead>
                          <TableHead>Última resposta</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queue.map((item) => {
                          const st = STATUS_MAP[item.status] ?? { label: item.status, variant: "outline" as const };
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <span className="text-sm font-medium">{item.lead_name || "Sem nome"}</span>
                                  <p className="text-xs text-muted-foreground">{formatPhone(item.lead_phone)}</p>
                                  {item.property_interest && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{item.property_interest}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={st.variant}>{st.label}</Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm">{item.attempt_count}</TableCell>
                              <TableCell className="text-xs">{item.status === "pending" ? formatDate(item.next_followup_at) : "—"}</TableCell>
                              <TableCell className="text-xs">{formatDate(item.last_outbound_at)}</TableCell>
                              <TableCell className="text-xs">{formatDate(item.last_inbound_at)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {!item.opted_out && item.status !== "opted_out" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                                      onClick={() => optOut(item.id)}
                                    >
                                      <Ban className="h-3 w-3" />
                                      Opt-out
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => reactivate(item.id)}
                                    >
                                      <Play className="h-3 w-3" />
                                      Reativar
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Histórico de Envios</CardTitle>
                <CardDescription>Mensagens de follow-up enviadas automaticamente</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum envio automático registrado ainda.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead className="text-center">Tentativa</TableHead>
                          <TableHead>Mensagem</TableHead>
                          <TableHead>Fonte</TableHead>
                          <TableHead>Enviado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">{formatPhone(log.lead_phone)}</TableCell>
                            <TableCell className="text-center text-sm">{log.attempt_number}</TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground line-clamp-2 max-w-[300px]">
                                {log.message_sent}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{log.message_source}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(log.sent_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-2xl font-bold">{value}</span>
      </CardContent>
    </Card>
  );
}
