import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RotateCcw, AlertTriangle } from "lucide-react";
import { useAiRouterProviders, type AiRouterProvider } from "@/hooks/useAiRouterProviders";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function NewProviderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProvider } = useAiRouterProviders();
  const [form, setForm] = useState<Partial<AiRouterProvider>>({
    provider_type: "groq",
    is_free: true,
    is_active: true,
    priority: 50,
    supports_image_input: false,
    supports_image_output: false,
  });

  const handleSave = () => {
    if (!form.provider_key || !form.display_name || !form.model_id || !form.env_secret_name || !form.api_base_url) return;
    createProvider.mutate(form as any, { onSuccess: () => { onClose(); setForm({ provider_type: "groq", is_free: true, is_active: true, priority: 50, supports_image_input: false, supports_image_output: false }); } });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Provider</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Provider Key (slug)</Label>
            <Input value={form.provider_key || ""} onChange={(e) => setForm({ ...form, provider_key: e.target.value })} placeholder="groq_key_c" />
          </div>
          <div>
            <Label>Nome de exibição</Label>
            <Input value={form.display_name || ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.provider_type || "groq"} onValueChange={(v) => setForm({ ...form, provider_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Model ID</Label>
            <Input value={form.model_id || ""} onChange={(e) => setForm({ ...form, model_id: e.target.value })} />
          </div>
          <div>
            <Label>Secret Name (env)</Label>
            <Input value={form.env_secret_name || ""} onChange={(e) => setForm({ ...form, env_secret_name: e.target.value })} placeholder="GROQ_KEY_C" />
          </div>
          <div>
            <Label>API Base URL</Label>
            <Input value={form.api_base_url || ""} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rate Limit RPM</Label>
              <Input type="number" value={form.rate_limit_rpm || ""} onChange={(e) => setForm({ ...form, rate_limit_rpm: parseInt(e.target.value) || null })} />
            </div>
            <div>
              <Label>Rate Limit RPD</Label>
              <Input type="number" value={form.rate_limit_rpd || ""} onChange={(e) => setForm({ ...form, rate_limit_rpd: parseInt(e.target.value) || null })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_free || false} onCheckedChange={(v) => setForm({ ...form, is_free: !!v })} />
              <Label>Gratuito</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.supports_image_input || false} onCheckedChange={(v) => setForm({ ...form, supports_image_input: !!v })} />
              <Label>Image Input</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.supports_image_output || false} onCheckedChange={(v) => setForm({ ...form, supports_image_output: !!v })} />
              <Label>Image Output</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={createProvider.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AiRouterProviders() {
  const { providers, isLoading, toggleActive, resetErrors } = useAiRouterProviders();
  const [showNew, setShowNew] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Provider
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Free</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>RPM / RPD</TableHead>
                  <TableHead>Erros</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.display_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{p.provider_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{p.model_id}</TableCell>
                    <TableCell>
                      {p.is_free
                        ? <Badge className="bg-green-500/10 text-green-700 text-[10px]">free</Badge>
                        : <Badge variant="destructive" className="text-[10px]">pago</Badge>}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell className="text-xs">{p.rate_limit_rpm || "—"} / {p.rate_limit_rpd || "—"}</TableCell>
                    <TableCell>
                      {p.consecutive_errors > 10 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Desabilitado ({p.consecutive_errors})
                        </Badge>
                      ) : p.consecutive_errors > 0 ? (
                        <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-700">
                          {p.consecutive_errors} erros
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">OK</span>
                      )}
                      {p.last_error_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(p.last_error_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.consecutive_errors > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetErrors.mutate(p.id)}
                          disabled={resetErrors.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NewProviderModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}
