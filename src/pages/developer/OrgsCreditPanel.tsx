import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  Wallet,
  Building2,
  User,
  Plus,
  Minus,
  History,
} from "lucide-react";
import { toast } from "sonner";

type OrgRow = {
  id: string;
  name: string;
  type: "imobiliaria" | "corretor_individual";
  document?: string | null;
};

type Wallet = {
  organization_id: string;
  balance_brl: number;
  total_consumed_brl: number | null;
  total_recharged_brl: number | null;
};

export function OrgsCreditPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | OrgRow["type"]>("all");
  const [selected, setSelected] = useState<OrgRow | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [operation, setOperation] = useState<"credit" | "debit">("credit");
  const [submitting, setSubmitting] = useState(false);
  const [historyOrg, setHistoryOrg] = useState<OrgRow | null>(null);

  const { data: orgs = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, type, document")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as OrgRow[]) ?? [];
    },
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["all-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_credit_wallets")
        .select("organization_id, balance_brl, total_consumed_brl, total_recharged_brl");
      if (error) throw error;
      return (data as Wallet[]) ?? [];
    },
  });

  const walletByOrg = useMemo(() => {
    const map: Record<string, Wallet> = {};
    wallets.forEach((w) => (map[w.organization_id] = w));
    return map;
  }, [wallets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (!q) return true;
      return (
        o.name?.toLowerCase().includes(q) ||
        o.document?.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [orgs, search, typeFilter]);

  const submit = async () => {
    if (!selected) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSubmitting(true);
    try {
      const signed = operation === "credit" ? value : -value;
      const { error } = await supabase.rpc("developer_credit_organization", {
        _organization_id: selected.id,
        _amount_brl: signed,
        _description: description.trim() || (operation === "credit" ? "Crédito manual (developer)" : "Débito manual (developer)"),
        _type: operation === "credit" ? "manual_credit" : "manual_debit",
      });
      if (error) throw error;
      toast.success(
        `${operation === "credit" ? "Crédito" : "Débito"} de R$ ${value.toFixed(2)} aplicado em ${selected.name}`,
      );
      setSelected(null);
      setAmount("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["all-wallets"] });
      qc.invalidateQueries({ queryKey: ["org-transactions", selected.id] });
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Central de créditos do agente de IA</CardTitle>
        <CardDescription>
          Adicione ou debite créditos manualmente em qualquer organização (imobiliária ou corretor individual)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ/CPF ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="imobiliaria">Imobiliárias</SelectItem>
              <SelectItem value="corretor_individual">Corretores individuais</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orgsLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma organização encontrada</p>
        ) : (
          <div className="divide-y rounded-md border">
            {filtered.map((o) => {
              const w = walletByOrg[o.id];
              const balance = Number(w?.balance_brl ?? 0);
              return (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {o.type === "imobiliaria" ? (
                      <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{o.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-1 text-[10px] py-0">
                          {o.type === "imobiliaria" ? "Imobiliária" : "Corretor"}
                        </Badge>
                        {o.document || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">saldo</p>
                    <p className={`font-bold ${balance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      R$ {balance.toFixed(2)}
                    </p>
                    {w && (
                      <p className="text-[10px] text-muted-foreground">
                        usado R$ {Number(w.total_consumed_brl ?? 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(o);
                        setOperation("credit");
                        setAmount("");
                        setDescription("");
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Creditar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setHistoryOrg(o)}>
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add/Remove credits dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {operation === "credit" ? "Adicionar" : "Debitar"} créditos
            </DialogTitle>
            {selected && (
              <CardDescription>
                {selected.name} · saldo atual:{" "}
                <strong>R$ {Number(walletByOrg[selected.id]?.balance_brl ?? 0).toFixed(2)}</strong>
              </CardDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={operation === "credit" ? "default" : "outline"}
                size="sm"
                onClick={() => setOperation("credit")}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-1" /> Creditar
              </Button>
              <Button
                type="button"
                variant={operation === "debit" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setOperation("debit")}
                className="flex-1"
              >
                <Minus className="h-4 w-4 mr-1" /> Debitar
              </Button>
            </div>
            <div>
              <Label htmlFor="amt">Valor (R$)</Label>
              <Input
                id="amt"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div>
              <Label htmlFor="desc">Descrição / motivo</Label>
              <Textarea
                id="desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: bônus de fidelidade, ajuste de cobrança..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              onClick={submit}
              disabled={submitting || !amount}
              variant={operation === "debit" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <OrgHistoryDialog org={historyOrg} onClose={() => setHistoryOrg(null)} />
    </Card>
  );
}

function OrgHistoryDialog({ org, onClose }: { org: OrgRow | null; onClose: () => void }) {
  const { data: tx = [], isLoading } = useQuery({
    queryKey: ["org-transactions", org?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_credit_transactions")
        .select("id, type, amount_brl, balance_after, description, created_at")
        .eq("organization_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!org,
  });

  return (
    <Dialog open={!!org} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Histórico — {org?.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : tx.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem movimentações</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {tx.map((t: any) => {
              const positive = Number(t.amount_brl) >= 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.description || t.type}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("pt-BR")} · {t.type}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold ${positive ? "text-primary" : "text-destructive"}`}>
                      {positive ? "+" : "-"} R$ {Math.abs(Number(t.amount_brl)).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      saldo: R$ {Number(t.balance_after).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
