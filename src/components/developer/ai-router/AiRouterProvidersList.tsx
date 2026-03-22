import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RotateCcw, AlertTriangle, Eye, EyeOff, Zap, ExternalLink, Key, Trash2, Search, ArrowRight, ArrowLeft, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAiRouterProviders, type AiRouterProvider } from "@/hooks/useAiRouterProviders";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ── Types ──

interface DiscoveredModel {
  id: string;
  name: string;
  is_free: boolean;
  supports_image_input: boolean;
  supports_image_output: boolean;
  context_window?: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  gemini: "Google Gemini",
  openai: "OpenAI",
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openai: "https://api.openai.com/v1/chat/completions",
};

// ── First-use banner ──

function NoKeysBanner({ providers }: { providers: AiRouterProvider[] }) {
  const anyHasKey = providers.some((p) => p.has_api_key);
  if (anyHasKey || providers.length === 0) return null;

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Nenhuma API key configurada</p>
            <p className="text-xs text-muted-foreground mt-1">
              As features de IA não funcionarão até que ao menos uma key seja adicionada.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3 w-3" /> Criar key Groq (grátis)
            </Button>
          </a>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3 w-3" /> Criar key Gemini (grátis)
            </Button>
          </a>
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3 w-3" /> Criar key OpenAI (pago)
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Edit API Key modal (for existing providers) ──

function EditApiKeyModal({
  provider,
  open,
  onClose,
}: {
  provider: AiRouterProvider | null;
  open: boolean;
  onClose: () => void;
}) {
  const { updateApiKey, testProvider } = useAiRouterProviders();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!open) { setApiKey(""); setShowKey(false); setTestResult(null); }
  }, [open]);

  const handleSave = () => {
    if (!provider) return;
    updateApiKey.mutate({ id: provider.id, api_key: apiKey }, { onSuccess: () => onClose() });
  };

  const handleTest = () => {
    if (!provider) return;
    setTestResult(null);
    testProvider.mutate(provider.provider_key, {
      onSuccess: (res) => setTestResult({ ok: true, msg: `✅ Funcionando (${res.latency}ms)` }),
      onError: (e: any) => setTestResult({ ok: false, msg: `❌ ${e.message}` }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" /> API Key — {provider?.display_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Colar API key aqui"
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {provider?.has_api_key && <p className="text-xs text-muted-foreground">🟢 Já existe uma key. Salvar irá substituí-la.</p>}
          {testResult && (
            <div className={`text-sm p-2 rounded ${testResult.ok ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"}`}>
              {testResult.msg}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testProvider.isPending}>
            {testProvider.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            Testar
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!apiKey || updateApiKey.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── New Provider Wizard (Step 1: key → Step 2: pick model) ──

function NewProviderWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProvider } = useAiRouterProviders();

  // Step 1 state
  const [step, setStep] = useState<1 | 2>(1);
  const [providerType, setProviderType] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Discovery state
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState("");

  // Step 2 state
  const [selectedModel, setSelectedModel] = useState<DiscoveredModel | null>(null);
  const [displayName, setDisplayName] = useState("");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setProviderType("groq");
      setApiKey("");
      setShowKey(false);
      setModels([]);
      setModelsLoading(false);
      setModelsError(null);
      setModelFilter("");
      setSelectedModel(null);
      setDisplayName("");
    }
  }, [open]);

  const discoverModels = useCallback(async () => {
    if (!apiKey || apiKey.length < 10) return;
    setModelsLoading(true);
    setModelsError(null);
    setModels([]);
    try {
      const { data, error } = await supabase.functions.invoke("list-ai-models", {
        body: { provider_type: providerType, api_key: apiKey },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao listar modelos");
      setModels(data.models || []);
      if ((data.models || []).length === 0) setModelsError("Nenhum modelo encontrado para esta key.");
      setStep(2);
    } catch (err: any) {
      setModelsError(err.message || "Erro ao buscar modelos");
    } finally {
      setModelsLoading(false);
    }
  }, [apiKey, providerType]);

  const handleSelectModel = (model: DiscoveredModel) => {
    setSelectedModel(model);
    setDisplayName(`${PROVIDER_LABELS[providerType] || providerType} — ${model.name || model.id}`);
  };

  const handleSave = () => {
    if (!selectedModel) return;
    const slug = `${providerType}_${selectedModel.id.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now().toString(36)}`;
    createProvider.mutate(
      {
        provider_key: slug,
        display_name: displayName || selectedModel.id,
        provider_type: providerType,
        model_id: selectedModel.id,
        env_secret_name: `${providerType.toUpperCase()}_API_KEY`,
        api_base_url: PROVIDER_BASE_URLS[providerType] || "",
        api_key: apiKey,
        is_free: selectedModel.is_free,
        is_active: true,
        priority: 50,
        supports_image_input: selectedModel.supports_image_input,
        supports_image_output: selectedModel.supports_image_output,
        rate_limit_rpm: null,
        rate_limit_rpd: null,
        notes: null,
      } as any,
      { onSuccess: () => onClose() }
    );
  };

  const filteredModels = models.filter(
    (m) => !modelFilter || m.id.toLowerCase().includes(modelFilter.toLowerCase()) || m.name.toLowerCase().includes(modelFilter.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Novo Provider — Passo 1: API Key" : "Novo Provider — Passo 2: Escolher Modelo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {step === 1 && (
            <>
              <div>
                <Label>Provedor</Label>
                <Select value={providerType} onValueChange={setProviderType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groq">Groq (grátis)</SelectItem>
                    <SelectItem value="gemini">Google Gemini (grátis)</SelectItem>
                    <SelectItem value="openai">OpenAI (pago)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>API Key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Colar API key aqui"
                    className="pr-10"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {modelsError && (
                <div className="text-xs p-2 rounded bg-destructive/10 text-destructive">{modelsError}</div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{PROVIDER_LABELS[providerType]}</Badge>
                <span>·</span>
                <span>{models.length} modelos · {models.filter(m => m.is_free).length} grátis</span>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} placeholder="Filtrar modelos..." className="pl-8 h-8 text-xs" />
              </div>

              <ScrollArea className="h-[220px]">
                <div className="space-y-1.5 pr-2">
                  {filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      className={`w-full text-left p-2.5 rounded-md border transition-colors text-sm ${
                        selectedModel?.id === model.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="font-medium">{model.id}</span>
                          {model.name !== model.id && (
                            <span className="text-muted-foreground ml-1.5 text-xs">({model.name})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {model.is_free ? (
                            <Badge className="bg-green-500/10 text-green-700 text-[10px]">free</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">pago</Badge>
                          )}
                          {model.supports_image_input && <Badge variant="outline" className="text-[10px]">👁️</Badge>}
                          {model.supports_image_output && <Badge variant="outline" className="text-[10px]">🖼️</Badge>}
                        </div>
                      </div>
                      {model.context_window && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {(model.context_window / 1000).toFixed(0)}k tokens
                        </p>
                      )}
                    </button>
                  ))}
                  {filteredModels.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum modelo encontrado.</p>
                  )}
                </div>
              </ScrollArea>

              {selectedModel && (
                <div>
                  <Label>Nome de exibição</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex: Groq — Llama 3" />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          {step === 2 && (
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancelar</Button>

          {step === 1 && (
            <Button onClick={discoverModels} disabled={apiKey.length < 10 || modelsLoading}>
              {modelsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowRight className="h-3.5 w-3.5 mr-1" />}
              Buscar Modelos
            </Button>
          )}

          {step === 2 && (
            <Button onClick={handleSave} disabled={!selectedModel || !displayName || createProvider.isPending}>
              {createProvider.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Criar Provider
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Provider Modal ──

function EditProviderModal({
  provider,
  open,
  onClose,
}: {
  provider: AiRouterProvider | null;
  open: boolean;
  onClose: () => void;
}) {
  const { updateProvider } = useAiRouterProviders();
  const [displayName, setDisplayName] = useState("");
  const [priority, setPriority] = useState("50");
  const [rateLimitRpm, setRateLimitRpm] = useState("");
  const [rateLimitRpd, setRateLimitRpd] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (provider && open) {
      setDisplayName(provider.display_name);
      setPriority(String(provider.priority ?? 50));
      setRateLimitRpm(provider.rate_limit_rpm ? String(provider.rate_limit_rpm) : "");
      setRateLimitRpd(provider.rate_limit_rpd ? String(provider.rate_limit_rpd) : "");
      setNotes(provider.notes || "");
    }
  }, [provider, open]);

  const handleSave = () => {
    if (!provider) return;
    updateProvider.mutate(
      {
        id: provider.id,
        display_name: displayName,
        priority: parseInt(priority) || 50,
        rate_limit_rpm: rateLimitRpm ? parseInt(rateLimitRpm) : null,
        rate_limit_rpd: rateLimitRpd ? parseInt(rateLimitRpd) : null,
        notes: notes || null,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar Provider
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome de exibição</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">RPM (limite)</Label>
              <Input type="number" value={rateLimitRpm} onChange={(e) => setRateLimitRpm(e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label className="text-xs">RPD (limite)</Label>
              <Input type="number" value={rateLimitRpd} onChange={(e) => setRateLimitRpd(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações opcionais..." />
          </div>
          {provider && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p><strong>Modelo:</strong> {provider.model_id}</p>
              <p><strong>Tipo:</strong> {provider.provider_type}</p>
              <p><strong>Base URL:</strong> {provider.api_base_url}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!displayName || updateProvider.isPending}>
            {updateProvider.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Key status badge ──

function KeyStatusBadge({ provider }: { provider: AiRouterProvider }) {
  if (provider.has_api_key) {
    return <Badge className="bg-green-500/10 text-green-700 text-[10px]">🟢 Key configurada</Badge>;
  }
  if (provider.env_secret_name) {
    return <Badge variant="outline" className="text-[10px] text-yellow-700 border-yellow-500/30">⚠️ Via Secret</Badge>;
  }
  return <Badge variant="destructive" className="text-[10px]">🔴 Sem key</Badge>;
}

// ── Main component ──

export function AiRouterProviders() {
  const { providers, isLoading, toggleActive, resetErrors, testProvider, deleteProvider } = useAiRouterProviders();
  const [editTarget, setEditTarget] = useState<AiRouterProvider | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [keyModal, setKeyModal] = useState<AiRouterProvider | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiRouterProvider | null>(null);

  const handleTestProvider = (p: AiRouterProvider) => {
    setTestingId(p.id);
    testProvider.mutate(p.provider_key, {
      onSuccess: (res) => { toast.success(`✅ ${p.display_name}: OK (${res.latency}ms)`); setTestingId(null); },
      onError: (e: any) => { toast.error(`❌ ${p.display_name}: ${e.message}`); setTestingId(null); },
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <NoKeysBanner providers={providers} />

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
                  <TableHead>API Key</TableHead>
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
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.provider_type}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{p.model_id}</TableCell>
                    <TableCell>
                      <button onClick={() => setKeyModal(p)} className="hover:opacity-80"><KeyStatusBadge provider={p} /></button>
                    </TableCell>
                    <TableCell>
                      {p.is_free
                        ? <Badge className="bg-green-500/10 text-green-700 text-[10px]">free</Badge>
                        : <Badge variant="destructive" className="text-[10px]">pago</Badge>}
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })} />
                    </TableCell>
                    <TableCell className="text-xs">{p.rate_limit_rpm || "—"} / {p.rate_limit_rpd || "—"}</TableCell>
                    <TableCell>
                      {p.consecutive_errors > 10 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />Desabilitado ({p.consecutive_errors})
                        </Badge>
                      ) : p.consecutive_errors > 0 ? (
                        <Badge variant="secondary" className="text-[10px] bg-destructive/10 text-destructive">{p.consecutive_errors} erros</Badge>
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
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleTestProvider(p)} disabled={testingId === p.id} title="Testar">
                          {testingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        </Button>
                        {p.consecutive_errors > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => resetErrors.mutate(p.id)} disabled={resetErrors.isPending}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditTarget(p)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p)} className="text-destructive hover:text-destructive" title="Deletar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NewProviderWizard open={showNew} onClose={() => setShowNew(false)} />
      <EditApiKeyModal provider={keyModal} open={!!keyModal} onClose={() => setKeyModal(null)} />
      <EditProviderModal provider={editTarget} open={!!editTarget} onClose={() => setEditTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar provider?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.display_name}</strong>? A API key associada também será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deleteProvider.mutate(deleteTarget.id); setDeleteTarget(null); }}
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
