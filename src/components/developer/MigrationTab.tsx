import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Play, CheckCircle2, AlertCircle, Loader2, Info, RotateCcw } from "lucide-react";

interface BatchResult {
  affected: number;
  message: string;
}

interface LogEntry {
  timestamp: string;
  operation: string;
  result: BatchResult;
  success: boolean;
}

const OPERATIONS = [
  {
    id: "migrate_owners_to_porto",
    label: "1. Migrar Owners → Porto",
    description: "Copia owners centralizados (tabela owners) da org de origem para o Porto Caiçara, deduplicando por telefone.",
    destructive: false,
  },
  {
    id: "migrate_property_owners_to_porto",
    label: "2. Migrar Property Owners → Porto",
    description: "Migra vínculos property_owners da org de origem para o Porto, remapeando property_id via source_property_id e owner_id via telefone.",
    destructive: false,
  },
  {
    id: "migrate_aliases_to_porto",
    label: "3. Migrar Aliases → Porto",
    description: "Copia owner_aliases da org de origem para os owners correspondentes no Porto Caiçara.",
    destructive: false,
  },
  {
    id: "check_status",
    label: "Verificar Status",
    description: "Verifica o progresso atual da migração de proprietários entre orgs.",
    destructive: false,
  },
  {
    id: "cleanup_lead_stages",
    label: "Limpar Estágios Órfãos",
    description: "Remove estágios de lead (lead_stages) que não possuem nenhum lead associado.",
    destructive: true,
  },
] as const;

export function MigrationTab() {
  const [selectedOp, setSelectedOp] = useState<string>("check_status");
  const [batchSize, setBatchSize] = useState<string>("100");
  const [running, setRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalAffected, setTotalAffected] = useState(0);

  const addLog = (operation: string, result: BatchResult, success: boolean) => {
    setLogs((prev) => [
      {
        timestamp: new Date().toLocaleTimeString("pt-BR"),
        operation,
        result,
        success,
      },
      ...prev.slice(0, 49), // keep last 50
    ]);
  };

  const runBatch = async (op?: string) => {
    const operation = op || selectedOp;
    setRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke("run-batch-migration", {
        body: { operation, batchSize: parseInt(batchSize) },
      });

      if (error) throw error;

      const result = data as BatchResult;
      addLog(operation, result, true);
      setTotalAffected((prev) => prev + result.affected);

      if (result.affected > 0) {
        toast.success(`Lote concluído: ${result.affected} registros processados`);
      } else {
        toast.info(result.message);
        setAutoRun(false);
      }

      return result;
    } catch (err: any) {
      const errorResult = { affected: 0, message: err.message || "Erro desconhecido" };
      addLog(operation, errorResult, false);
      toast.error(`Erro: ${err.message}`);
      setAutoRun(false);
      return null;
    } finally {
      setRunning(false);
    }
  };

  const runAutoLoop = async () => {
    setAutoRun(true);
    setTotalAffected(0);
    let keepGoing = true;

    while (keepGoing) {
      const result = await runBatch(selectedOp);
      if (!result || result.affected === 0) {
        keepGoing = false;
      }
      // Small delay between batches
      await new Promise((r) => setTimeout(r, 800));
    }

    setAutoRun(false);
    toast.success("Processo automático concluído!");
  };

  const stopAutoRun = () => {
    setAutoRun(false);
  };

  const currentOp = OPERATIONS.find((o) => o.id === selectedOp);

  return (
    <div className="space-y-4">
      {/* Operation selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Migração em Lotes
          </CardTitle>
          <CardDescription>
            Execute operações de migração de dados em lotes para evitar timeouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operação</label>
              <Select value={selectedOp} onValueChange={setSelectedOp} disabled={running || autoRun}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONS.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tamanho do lote</label>
              <Select value={batchSize} onValueChange={setBatchSize} disabled={running || autoRun}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 registros</SelectItem>
                  <SelectItem value="100">100 registros</SelectItem>
                  <SelectItem value="200">200 registros</SelectItem>
                  <SelectItem value="500">500 registros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentOp && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">{currentOp.description}</p>
                {currentOp.destructive && (
                  <Badge variant="destructive" className="mt-1.5 text-xs">Destrutivo</Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => runBatch()}
              disabled={running || autoRun}
              size="sm"
            >
              {running && !autoRun ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1.5" />
              )}
              Executar 1 Lote
            </Button>

            {selectedOp !== "check_status" && (
              <>
                {autoRun ? (
                  <Button
                    onClick={stopAutoRun}
                    variant="destructive"
                    size="sm"
                  >
                    Parar
                  </Button>
                ) : (
                  <Button
                    onClick={runAutoLoop}
                    disabled={running}
                    variant="outline"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Executar até concluir
                  </Button>
                )}
              </>
            )}
          </div>

          {autoRun && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processando automaticamente...</span>
                <span className="font-mono font-medium">{totalAffected} registros</span>
              </div>
              <Progress className="h-2" value={undefined} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log de Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/30"
                >
                  {log.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{log.result.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.timestamp} · {OPERATIONS.find((o) => o.id === log.operation)?.label || log.operation}
                    </p>
                  </div>
                  {log.result.affected > 0 && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      +{log.result.affected}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
