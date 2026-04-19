import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PhoneCall, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TimelineStep = { step: string; ok: boolean; data?: any; error?: string; reason?: string; [k: string]: any };

export function RetellTestPipelineButton() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("Teste Retell");
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [result, setResult] = useState<{ ok?: boolean; lead_id?: string; call_id?: string | null } | null>(null);

  const run = async () => {
    setLoading(true);
    setTimeline([]);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("retell-test-pipeline", {
        body: { phone, name },
      });
      if (error) throw error;
      setTimeline(data?.timeline ?? []);
      setResult({ ok: data?.ok, lead_id: data?.lead_id, call_id: data?.call_id ?? null });
      if (data?.ok) {
        toast.success("Pipeline OK", { description: `Call ID: ${data.call_id}` });
      } else {
        const failed = (data?.timeline ?? []).find((s: TimelineStep) => !s.ok);
        toast.error("Pipeline falhou", { description: failed?.reason || failed?.error || failed?.step || "Erro desconhecido" });
      }
    } catch (err: any) {
      toast.error("Erro ao executar teste", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PhoneCall className="h-4 w-4" />
          Testar pipeline (ligar para meu número)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Teste ponta-a-ponta do Retell</DialogTitle>
          <DialogDescription>
            Cria um lead de teste, valida configuração, dispara chamada Retell e mostra cada etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="test-name">Nome do lead</Label>
            <Input id="test-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="test-phone">Telefone (com DDD)</Label>
            <Input id="test-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11999999999" />
          </div>

          {timeline.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 max-h-72 overflow-auto">
              {timeline.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {s.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{s.step}</div>
                    {(s.reason || s.error) && (
                      <div className="text-muted-foreground break-all">
                        {s.reason || s.error}
                      </div>
                    )}
                    {s.call_id && <div className="text-muted-foreground">call_id: {s.call_id}</div>}
                    {s.queue && (
                      <div className="text-muted-foreground">
                        queue: {s.queue.status} (attempt {s.queue.attempt_count ?? 0})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result?.ok && result.call_id && (
            <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-xs">
              ✅ Chamada criada. Você deve receber a ligação em instantes.
              <div className="mt-1 text-muted-foreground">Lead: {result.lead_id} · Call: {result.call_id}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            Fechar
          </Button>
          <Button onClick={run} disabled={loading || !phone}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PhoneCall className="h-4 w-4 mr-2" />}
            Executar teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
