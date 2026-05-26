import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Clock, FileText, Eye } from "lucide-react";
import { toast } from "sonner";

type Request = {
  id: string;
  organization_id: string;
  user_id: string;
  amount_brl: number;
  pix_key: string;
  receipt_path: string | null;
  receipt_validation: any | null;
  receipt_mime: string | null;
  receipt_size_bytes: number | null;
  notes: string | null;
  status: string;
  credits_granted: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export default function RechargeApprovals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<Request | null>(null);
  const [rejectDialog, setRejectDialog] = useState<Request | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [creditsToGrant, setCreditsToGrant] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["all-recharge-requests", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_recharge_requests")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
  });

  const { data: orgs = {} } = useQuery({
    queryKey: ["orgs-for-recharge", requests.map((r) => r.organization_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set(requests.map((r) => r.organization_id))];
      if (!ids.length) return {};
      const { data } = await supabase.from("organizations").select("id, name").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((o: any) => (map[o.id] = o.name));
      return map;
    },
    enabled: requests.length > 0,
  });

  const approve = async (req: Request, customAmount?: number) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("approve_recharge_request", {
        _request_id: req.id,
        _credits_brl: customAmount ?? null,
      });
      if (error) throw error;
      toast.success(`Recarga aprovada: R$ ${(customAmount ?? req.amount_brl).toFixed(2)} creditados`);
      setSelected(null);
      setCreditsToGrant("");
      qc.invalidateQueries({ queryKey: ["all-recharge-requests"] });
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!rejectDialog) return;
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("credit_recharge_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim(),
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", rejectDialog.id);
      if (error) throw error;
      toast.success("Solicitação rejeitada");
      setRejectDialog(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["all-recharge-requests"] });
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const viewReceipt = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("recharge-receipts")
      .createSignedUrl(path, 300);
    if (error) {
      toast.error("Erro ao gerar link do comprovante");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Central de Recargas</h1>
        <p className="text-sm text-muted-foreground">Aprove recargas via PIX e gerencie créditos do agente de IA por organização</p>
      </div>

      <Tabs defaultValue="pix">
        <TabsList>
          <TabsTrigger value="pix" className="gap-1">Solicitações PIX</TabsTrigger>
          <TabsTrigger value="orgs" className="gap-1">Organizações</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="mt-4">
          <OrgsCreditPanel />
        </TabsContent>

        <TabsContent value="pix" className="mt-4">


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1"><Clock className="h-3 w-3" /> Pendentes</TabsTrigger>
          <TabsTrigger value="approved" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : requests.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação</p>
              ) : (
                <div className="divide-y">
                  {requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30">
                      <div className="flex-1">
                        <p className="font-medium">
                          R$ {Number(r.amount_brl).toFixed(2)}
                          {r.credits_granted != null && r.credits_granted !== Number(r.amount_brl) && (
                            <span className="ml-2 text-xs text-primary">(creditado: R$ {Number(r.credits_granted).toFixed(2)})</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {orgs[r.organization_id] || r.organization_id} · {new Date(r.created_at).toLocaleString("pt-BR")}
                        </p>
                        {r.notes && <p className="text-xs mt-1 italic">"{r.notes}"</p>}
                        {r.rejection_reason && <p className="text-xs text-destructive mt-1">Motivo: {r.rejection_reason}</p>}
                        {r.receipt_validation && (
                          <div className="mt-2 text-[11px] space-y-0.5">
                            {r.receipt_validation.extracted?.amount_brl != null && (
                              <p>
                                <span className="text-muted-foreground">OCR valor:</span>{" "}
                                <strong>R$ {Number(r.receipt_validation.extracted.amount_brl).toFixed(2)}</strong>
                                {r.receipt_validation.extracted.date && ` · ${r.receipt_validation.extracted.date}`}
                              </p>
                            )}
                            {r.receipt_validation.extracted?.pix_key && (
                              <p className="text-muted-foreground">OCR PIX: {r.receipt_validation.extracted.pix_key}</p>
                            )}
                            {r.receipt_validation.warnings?.length > 0 ? (
                              <ul className="text-amber-600 list-disc list-inside">
                                {r.receipt_validation.warnings.map((w: string, i: number) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-primary">✓ Comprovante validado automaticamente</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">

                        {r.receipt_path && (
                          <Button size="sm" variant="ghost" onClick={() => viewReceipt(r.receipt_path!)}>
                            <FileText className="h-4 w-4 mr-1" /> Comprovante
                          </Button>
                        )}
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setSelected(r); setCreditsToGrant(String(r.amount_brl)); }}>
                              <Eye className="h-4 w-4 mr-1" /> Analisar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar recarga</DialogTitle>
            <CardDescription>
              {selected && (
                <>Organização: <strong>{orgs[selected.organization_id] || selected.organization_id}</strong> · valor declarado: <strong>R$ {Number(selected.amount_brl).toFixed(2)}</strong></>
              )}
            </CardDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="credits">Valor a creditar (R$)</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                step="0.01"
                value={creditsToGrant}
                onChange={(e) => setCreditsToGrant(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Por padrão, 1 BRL pago = 1 BRL de crédito</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => { if (selected) { setRejectDialog(selected); setSelected(null); } }}
            >
              Rejeitar
            </Button>
            <Button
              onClick={() => selected && approve(selected, Number(creditsToGrant))}
              disabled={actionLoading || !creditsToGrant}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Aprovar e creditar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: comprovante ilegível, valor não bate..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
