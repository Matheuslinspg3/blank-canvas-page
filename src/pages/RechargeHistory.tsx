import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Wallet, ArrowDownCircle, ArrowUpCircle, FileText } from "lucide-react";

export default function RechargeHistory() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: requests = [] } = useQuery({
    queryKey: ["recharge-history-requests", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_recharge_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: tx = [] } = useQuery({
    queryKey: ["credit-transactions", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_credit_transactions")
        .select("id, type, amount_brl, balance_after, description, metadata, created_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const viewReceipt = async (path: string) => {
    const { data } = await supabase.storage.from("recharge-receipts").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/recarregar-creditos")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-display">Histórico e Auditoria</h1>
          <p className="text-sm text-muted-foreground">Solicitações de recarga e transações de crédito</p>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" className="gap-1">
            <Wallet className="h-3 w-3" /> Solicitações ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1">
            <FileText className="h-3 w-3" /> Transações ({tx.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Solicitações de recarga</CardTitle>
              <CardDescription>Status, motivo de rejeição e valor creditado</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {requests.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação registrada</p>
              ) : (
                <div className="divide-y">
                  {requests.map((r: any) => (
                    <div key={r.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">R$ {Number(r.amount_brl).toFixed(2)}</p>
                          <StatusBadge status={r.status} />
                          {r.credits_granted != null && r.credits_granted !== Number(r.amount_brl) && (
                            <span className="text-xs text-primary">
                              creditado: R$ {Number(r.credits_granted).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Solicitado: {new Date(r.created_at).toLocaleString("pt-BR")}
                          {r.approved_at && ` · Processado: ${new Date(r.approved_at).toLocaleString("pt-BR")}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-1">Ref: {r.id.slice(0, 8)}</p>
                        {r.notes && <p className="text-xs italic mt-1">"{r.notes}"</p>}
                        {r.status === "rejected" && r.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">
                            <strong>Motivo da rejeição:</strong> {r.rejection_reason}
                          </p>
                        )}
                        {r.receipt_validation?.warnings?.length > 0 && (
                          <ul className="text-[11px] text-amber-600 mt-1 list-disc list-inside">
                            {r.receipt_validation.warnings.slice(0, 3).map((w: string, i: number) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {r.receipt_path && (
                        <Button size="sm" variant="ghost" onClick={() => viewReceipt(r.receipt_path)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transações de crédito</CardTitle>
              <CardDescription>Movimentações da carteira com data e referência</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tx.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma transação</p>
              ) : (
                <div className="divide-y">
                  {tx.map((t: any) => {
                    const isCredit = Number(t.amount_brl) >= 0 && (t.type === "recharge" || t.type === "plan_credit");
                    const ref = t.metadata?.request_id || t.metadata?.message_id || t.metadata?.reference || null;
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {isCredit ? (
                            <ArrowDownCircle className="h-5 w-5 text-primary mt-0.5" />
                          ) : (
                            <ArrowUpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {t.description || t.type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleString("pt-BR")}
                              {ref && <span className="font-mono ml-2">ref: {String(ref).slice(0, 8)}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold ${isCredit ? "text-primary" : "text-foreground"}`}>
                            {isCredit ? "+" : "-"} R$ {Math.abs(Number(t.amount_brl)).toFixed(2)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            saldo: R$ {Number(t.balance_after).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge variant="default" className="gap-1 bg-primary/15 text-primary border-primary/30">
        <CheckCircle2 className="h-3 w-3" /> Aprovada
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Rejeitada
      </Badge>
    );
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> Pendente
    </Badge>
  );
}
