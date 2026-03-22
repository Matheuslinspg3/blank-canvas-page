import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, ArrowDownRight } from "lucide-react";
import { useAiRouterLogs, type AiRouterLogFilters } from "@/hooks/useAiRouterLogs";
import { useAiRouterConfig } from "@/hooks/useAiRouterConfig";
import { useAiRouterProviders } from "@/hooks/useAiRouterProviders";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function AiRouterLogs() {
  const [filters, setFilters] = useState<AiRouterLogFilters>({
    period: "today",
    page: 0,
  });

  const { data, isLoading } = useAiRouterLogs(filters);
  const { tasks } = useAiRouterConfig();
  const { providers } = useAiRouterProviders();

  const { data: orgs } = useQuery({
    queryKey: ["orgs-list-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("id, name").order("name").limit(100);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / (data?.pageSize || 20));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Organização</Label>
              <Select value={filters.organization_id || "all"} onValueChange={(v) => setFilters({ ...filters, organization_id: v === "all" ? undefined : v, page: 0 })}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(orgs || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Task</Label>
              <Select value={filters.task_type || "all"} onValueChange={(v) => setFilters({ ...filters, task_type: v === "all" ? undefined : v, page: 0 })}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.task_type} value={t.task_type}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Provider</Label>
              <Select value={filters.provider_used || "all"} onValueChange={(v) => setFilters({ ...filters, provider_used: v === "all" ? undefined : v, page: 0 })}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.provider_key} value={p.provider_key}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Período</Label>
              <Select value={filters.period || "today"} onValueChange={(v: any) => setFilters({ ...filters, period: v, page: 0 })}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7d">7 dias</SelectItem>
                  <SelectItem value="30d">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                checked={filters.errors_only || false}
                onCheckedChange={(v) => setFilters({ ...filters, errors_only: !!v, page: 0 })}
              />
              <Label className="text-xs">Só erros</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Nenhum log encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horário</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Latência</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead>Free</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const hasFallback = (log.providers_attempted?.length || 0) > 1;
                    return (
                      <Collapsible key={log.id} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className={`cursor-pointer ${!log.success ? "bg-destructive/5" : ""}`}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-xs font-medium">{log.task_type}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{log.org_name}</TableCell>
                              <TableCell className="text-xs">
                                {log.provider_used || "—"}
                                {hasFallback && (
                                  <Badge variant="outline" className="ml-1 text-[9px] px-1">
                                    <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />fallback
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{log.model_used || "—"}</TableCell>
                              <TableCell className="text-xs text-right">{log.latency_ms}ms</TableCell>
                              <TableCell className="text-xs text-right">{log.tokens_input + log.tokens_output}</TableCell>
                              <TableCell>
                                {log.is_free
                                  ? <Badge className="bg-green-500/10 text-green-700 text-[9px]">free</Badge>
                                  : <Badge variant="destructive" className="text-[9px]">pago</Badge>}
                              </TableCell>
                              <TableCell>
                                {log.success
                                  ? <Badge className="bg-green-500/10 text-green-700 text-[9px]">OK</Badge>
                                  : <Badge variant="destructive" className="text-[9px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Erro</Badge>}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/30 py-3 px-6">
                                <div className="space-y-1 text-xs">
                                  {hasFallback && (
                                    <p><span className="font-medium">Cadeia tentada:</span> {log.providers_attempted?.join(" → ")}</p>
                                  )}
                                  {log.error_message && (
                                    <p className="text-destructive"><span className="font-medium">Erro:</span> {log.error_message}</p>
                                  )}
                                  {log.prompt_preview && (
                                    <p className="text-muted-foreground"><span className="font-medium">Prompt:</span> {log.prompt_preview}</p>
                                  )}
                                  <p className="text-muted-foreground">
                                    Tokens: {log.tokens_input} in + {log.tokens_output} out | Custo: ${log.estimated_cost_usd.toFixed(6)}
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{totalCount} logs</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={(filters.page || 0) === 0}
              onClick={() => setFilters({ ...filters, page: (filters.page || 0) - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs">{(filters.page || 0) + 1} / {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={(filters.page || 0) >= totalPages - 1}
              onClick={() => setFilters({ ...filters, page: (filters.page || 0) + 1 })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
