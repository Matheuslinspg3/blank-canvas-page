import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, Brain, Key, Eye, EyeOff, AlertTriangle, CheckCircle2, Cpu } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AIModel {
  id: string;
  label: string;
  description: string;
}

interface AIProviderInfo {
  label: string;
  models: AIModel[];
}

const AI_PROVIDERS: Record<string, AIProviderInfo> = {
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o", description: "Mais inteligente, multimodal" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", description: "Rápido e econômico" },
      { id: "gpt-4.1", label: "GPT-4.1", description: "Último modelo, raciocínio avançado" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", description: "Rápido, ótimo custo-benefício" },
      { id: "gpt-4.1-nano", label: "GPT-4.1 Nano", description: "Ultra rápido, tarefas simples" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", description: "Melhor equilíbrio qualidade/custo" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", description: "Rápido e econômico" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4", description: "Máxima qualidade, mais caro" },
    ],
  },
  gemini: {
    label: "Google Gemini",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Rápido e barato" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Alta qualidade, contexto grande" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", description: "Equilibrado" },
    ],
  },
  groq: {
    label: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", description: "Rápido, open-source" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", description: "Ultra rápido, tarefas simples" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", description: "Bom equilíbrio" },
    ],
  },
};

type ProviderKey = string;

export function AgentAIProviderTab() {
  const { config, saveConfig, isSaving, isLoading } = useWhatsAppAgentConfig();
  const [provider, setProvider] = useState<ProviderKey>("openai");
  const [model, setModel] = useState("gpt-4o");
  const [mode, setMode] = useState<"platform" | "byok">("platform");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (config) {
      const p = (config as any).ai_provider ?? "openai";
      setProvider(p);
      setModel((config as any).ai_model ?? "gpt-4o");
      setMode((config as any).ai_mode ?? "platform");
      setApiKey((config as any).byok_api_key ?? "");
    }
  }, [config]);

  const handleProviderChange = (newProvider: ProviderKey) => {
    setProvider(newProvider);
    const models = AI_PROVIDERS[newProvider].models;
    setModel(models[0].id);
  };

  const currentModels = AI_PROVIDERS[provider]?.models ?? [];
  const selectedModel = currentModels.find((m) => m.id === model);

  const isByok = mode === "byok";
  const keyMasked = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : "";

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" /> Modo de IA
          </CardTitle>
          <CardDescription>
            Escolha entre usar a IA da plataforma (inclusa no plano) ou sua própria chave de API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("platform")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                !isByok
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">IA da Plataforma</span>
                {!isByok && <Badge variant="default" className="text-[10px] ml-auto">Ativo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Uso incluso no seu plano. Sem necessidade de configuração extra.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("byok")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                isByok
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Key className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Sua Própria Chave (BYOK)</span>
                {isByok && <Badge variant="default" className="text-[10px] ml-auto">Ativo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Use sua conta do provedor. Você gerencia os créditos diretamente.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Provider & Model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" /> Provedor & Modelo
          </CardTitle>
          <CardDescription>
            Selecione o provedor e modelo de IA para o agente WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select value={provider} onValueChange={(v) => handleProviderChange(v as ProviderKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedModel && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>
                <strong>{AI_PROVIDERS[provider].label}</strong> — {selectedModel.label}: {selectedModel.description}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BYOK API Key */}
      {isByok && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4" /> Chave de API ({AI_PROVIDERS[provider].label})
            </CardTitle>
            <CardDescription>
              Insira sua chave de API do {AI_PROVIDERS[provider].label}. Ela será armazenada com segurança.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Cole sua chave do ${AI_PROVIDERS[provider].label} aqui...`}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {apiKey && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Chave configurada: {keyMasked}
                </p>
              )}
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                No modo BYOK, os custos de IA são cobrados diretamente na sua conta do {AI_PROVIDERS[provider].label}. 
                Gerencie seus créditos e limites no painel do provedor.
              </AlertDescription>
            </Alert>

            {provider === "openai" && (
              <p className="text-xs text-muted-foreground">
                Obtenha sua chave em{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline text-primary">
                  platform.openai.com/api-keys
                </a>
              </p>
            )}
            {provider === "anthropic" && (
              <p className="text-xs text-muted-foreground">
                Obtenha sua chave em{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline text-primary">
                  console.anthropic.com
                </a>
              </p>
            )}
            {provider === "gemini" && (
              <p className="text-xs text-muted-foreground">
                Obtenha sua chave em{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline text-primary">
                  aistudio.google.com
                </a>
              </p>
            )}
            {provider === "groq" && (
              <p className="text-xs text-muted-foreground">
                Obtenha sua chave em{" "}
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline text-primary">
                  console.groq.com
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() =>
            saveConfig({
              ai_provider: provider,
              ai_model: model,
              ai_mode: mode,
              byok_api_key: isByok ? apiKey || null : null,
            } as any)
          }
          disabled={isSaving || (isByok && !apiKey)}
        >
          <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Configuração de IA"}
        </Button>
      </div>
    </div>
  );
}
