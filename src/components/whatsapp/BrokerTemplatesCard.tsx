import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { useBrokerTemplates, type BrokerTemplate } from "@/hooks/whatsapp/useBrokerTemplates";

const CATEGORIES = [
  { value: "saudacao", label: "Saudação" },
  { value: "followup", label: "Follow-up" },
  { value: "reativacao", label: "Reativação" },
  { value: "pos_visita", label: "Pós-visita" },
  { value: "pos_proposta", label: "Pós-proposta" },
  { value: "personalizado", label: "Personalizado" },
] as const;

const PLACEHOLDERS = [
  { tag: "{nome}", desc: "Nome do lead" },
  { tag: "{imovel}", desc: "Imóvel de interesse" },
];

export function BrokerTemplatesCard() {
  const { templates, isLoading, create, update, remove, isCreating } = useBrokerTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerTemplate | null>(null);
  const [form, setForm] = useState({ name: "", category: "personalizado", body: "" });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", category: "personalizado", body: "" });
    setDialogOpen(true);
  };

  const openEdit = (t: BrokerTemplate) => {
    setEditing(t);
    setForm({ name: t.name, category: t.category, body: t.body });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    if (editing) {
      await update({ id: editing.id, name: form.name, category: form.category, body: form.body });
    } else {
      await create(form);
    }
    setDialogOpen(false);
  };

  const categoryLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label ?? val;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Templates Pessoais
            </CardTitle>
            <CardDescription>Mensagens prontas para saudação, follow-up e mais</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Ex: Saudação inicial"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    placeholder="Oi {nome}! Tudo bem? Vi que você tem interesse em {imovel}..."
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={4}
                  />
                  <div className="flex gap-2 flex-wrap">
                    {PLACEHOLDERS.map((p) => (
                      <Badge
                        key={p.tag}
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => setForm((f) => ({ ...f, body: f.body + p.tag }))}
                      >
                        {p.tag} — {p.desc}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button onClick={handleSave} disabled={isCreating} className="w-full">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editing ? "Salvar alterações" : "Criar template"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum template ainda. Crie o primeiro para usar em saudações e follow-ups.
          </p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {categoryLabel(t.category)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => remove(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
