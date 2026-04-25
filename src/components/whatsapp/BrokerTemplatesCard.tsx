import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, FileText, Loader2, Eye, AlertTriangle } from "lucide-react";
import { useBrokerTemplates, type BrokerTemplate } from "@/hooks/whatsapp/useBrokerTemplates";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "saudacao", label: "Saudação" },
  { value: "followup", label: "Follow-up" },
  { value: "reativacao", label: "Reativação" },
  { value: "pos_visita", label: "Pós-visita" },
  { value: "pos_proposta", label: "Pós-proposta" },
  { value: "personalizado", label: "Personalizado" },
] as const;

const PLACEHOLDERS = [
  { tag: "{nome}", desc: "Nome do lead", sample: "João Silva" },
  { tag: "{imovel}", desc: "Imóvel de interesse", sample: "Apt 3 quartos - Centro" },
  { tag: "{telefone}", desc: "Telefone do lead", sample: "11999887766" },
  { tag: "{corretor}", desc: "Nome do corretor", sample: "Maria Santos" },
  { tag: "{data}", desc: "Data atual", sample: new Date().toLocaleDateString("pt-BR") },
  { tag: "{tentativa}", desc: "Nº da tentativa", sample: "1" },
];

const SUPPORTED_TAGS = PLACEHOLDERS.map((p) => p.tag);

/** Replace all known placeholders with sample values */
function renderPreview(body: string): string {
  let result = body;
  for (const p of PLACEHOLDERS) {
    result = result.replace(new RegExp(p.tag.replace(/[{}().]/g, "\\$&"), "gi"), p.sample);
  }
  return result;
}

/** Find unknown placeholders like {xyz} that aren't in the supported list */
function findUnknownPlaceholders(body: string): string[] {
  const allTags: string[] = body.match(/\{[a-zA-Z_.]+\}/g) ?? [];
  const supportedTags = new Set<string>(SUPPORTED_TAGS);
  return allTags.filter((tag) => !supportedTags.has(tag.toLowerCase()));
}

export function BrokerTemplatesCard() {
  const { templates, isLoading, create, update, remove, isCreating } = useBrokerTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerTemplate | null>(null);
  const [form, setForm] = useState({ name: "", category: "personalizado", body: "" });
  const [showPreview, setShowPreview] = useState(false);

  const preview = useMemo(() => renderPreview(form.body), [form.body]);
  const unknownTags = useMemo(() => findUnknownPlaceholders(form.body), [form.body]);
  const hasContent = form.name.trim().length > 0 && form.body.trim().length > 0;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", category: "personalizado", body: "" });
    setShowPreview(false);
    setDialogOpen(true);
  };

  const openEdit = (t: BrokerTemplate) => {
    setEditing(t);
    setForm({ name: t.name, category: t.category, body: t.body });
    setShowPreview(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!hasContent) return;

    if (form.name.trim().length > 100) {
      toast.error("Nome deve ter no máximo 100 caracteres");
      return;
    }
    if (form.body.trim().length > 2000) {
      toast.error("Mensagem deve ter no máximo 2000 caracteres");
      return;
    }

    if (unknownTags.length > 0) {
      toast.error(`Placeholders desconhecidos: ${unknownTags.join(", ")}. Use apenas os suportados.`);
      return;
    }

    // Validate rendered preview isn't empty after placeholder replacement
    const rendered = renderPreview(form.body);
    if (!rendered.trim()) {
      toast.error("A mensagem fica vazia após substituir os placeholders");
      return;
    }

    if (editing) {
      await update({ id: editing.id, name: form.name.trim(), category: form.category, body: form.body.trim() });
    } else {
      await create({ name: form.name.trim(), category: form.category, body: form.body.trim() });
    }
    setDialogOpen(false);
  };

  const insertPlaceholder = (tag: string) => {
    setForm((f) => ({ ...f, body: f.body + tag }));
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
            <DialogContent className="sm:max-w-lg">
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
                    maxLength={100}
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
                  <div className="flex items-center justify-between">
                    <Label>Mensagem</Label>
                    <span className="text-xs text-muted-foreground">{form.body.length}/2000</span>
                  </div>
                  <Textarea
                    placeholder="Oi {nome}! Tudo bem? Vi que você tem interesse em {imovel}..."
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={4}
                    maxLength={2000}
                  />

                  {/* Placeholder chips */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Variáveis disponíveis:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {PLACEHOLDERS.map((p) => (
                        <Badge
                          key={p.tag}
                          variant="outline"
                          className="cursor-pointer text-xs hover:bg-primary/10 transition-colors"
                          onClick={() => insertPlaceholder(p.tag)}
                          title={`Clique para inserir — valor exemplo: ${p.sample}`}
                        >
                          {p.tag} — {p.desc}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Unknown tag warning */}
                  {unknownTags.length > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Placeholder(s) não suportado(s): <strong>{unknownTags.join(", ")}</strong>.
                        Use apenas as variáveis listadas acima.
                      </span>
                    </div>
                  )}
                </div>

                {/* Preview toggle */}
                {form.body.trim() && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 w-full"
                      onClick={() => setShowPreview((v) => !v)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {showPreview ? "Ocultar pré-visualização" : "Pré-visualizar mensagem"}
                    </Button>
                    {showPreview && (
                      <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap">
                        {preview}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={isCreating || !hasContent || unknownTags.length > 0}
                  className="w-full"
                >
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
