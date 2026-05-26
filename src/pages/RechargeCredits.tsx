import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Wallet, Upload, ArrowLeft, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { PixQRCode } from "@/components/credits/PixQRCode";
import { toast } from "sonner";
import { z } from "zod";

const PIX_KEY = "13996666432";
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

const formSchema = z.object({
  amount: z.number().positive("Informe um valor maior que zero").max(50000, "Valor máximo de R$ 50.000"),
  notes: z.string().max(500).optional(),
});

export default function RechargeCredits() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;

  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["automation-wallet", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase
        .from("automation_credit_wallets")
        .select("balance_brl")
        .eq("organization_id", orgId)
        .maybeSingle();
      return data;
    },
    enabled: !!orgId,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["recharge-requests", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_recharge_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const handleSubmit = async () => {
    if (!user || !orgId) return;
    const parsed = formSchema.safeParse({ amount: Number(amount), notes: notes || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("recharge-receipts")
          .upload(path, receiptFile, { upsert: false });
        if (upErr) throw upErr;
        receiptPath = path;
      }

      const { data: inserted, error } = await supabase
        .from("credit_recharge_requests")
        .insert({
          organization_id: orgId,
          user_id: user.id,
          amount_brl: parsed.data.amount,
          pix_key: PIX_KEY,
          receipt_path: receiptPath,
          notes: parsed.data.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      // Notifica o developer por email (best-effort)
      supabase.functions.invoke("notify-recharge-request", {
        body: { request_id: inserted.id },
      }).catch((e) => console.warn("notify-recharge-request failed", e));

      toast.success("Solicitação enviada! Aguarde aprovação.");
      setAmount("");
      setNotes("");
      setReceiptFile(null);
      qc.invalidateQueries({ queryKey: ["recharge-requests", orgId] });
    } catch (e: any) {
      toast.error(`Erro: ${e.message || "Falha ao enviar"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-display">Recarregar Créditos</h1>
          <p className="text-sm text-muted-foreground">Pague via PIX e envie seu comprovante</p>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Saldo atual</p>
              <p className="text-xl font-bold">R$ {Number(wallet?.balance_brl ?? 0).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Pague via PIX</CardTitle>
            <CardDescription>Use o QR Code ou copie a chave abaixo</CardDescription>
          </CardHeader>
          <CardContent>
            <PixQRCode pixKey={PIX_KEY} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Envie sua solicitação</CardTitle>
            <CardDescription>Informe o valor pago e anexe o comprovante</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Valor pago (R$)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="receipt">Comprovante (imagem ou PDF)</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Upload className="h-3 w-3" /> {receiptFile.name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Algo que queira informar?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting || !amount} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar solicitação
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma solicitação ainda</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">R$ {Number(r.amount_brl).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </p>
                    {r.status === "rejected" && r.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">Motivo: {r.rejection_reason}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
