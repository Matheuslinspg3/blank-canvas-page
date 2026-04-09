import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, FileText, LayoutTemplate, Globe, FileStack } from "lucide-react";
import type { SiteMode } from "@/hooks/useSiteAIGeneration";

export type AIGenerationMode = "text_only" | "full_layout";

export interface AIContentAnswers {
  target_audience: string;
  differentials: string;
  tone: string;
  region_focus: string;
  extra_info: string;
  reference_url: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (answers: AIContentAnswers, mode: AIGenerationMode, siteMode?: SiteMode) => void;
  isGenerating: boolean;
  showLayoutOption?: boolean;
}

const TONE_OPTIONS = [
  { value: "profissional", label: "Profissional" },
  { value: "acolhedor", label: "Acolhedor" },
  { value: "luxo", label: "Luxo / Sofisticado" },
  { value: "jovem", label: "Jovem / Moderno" },
  { value: "tecnico", label: "Técnico / Informativo" },
];

const MODE_OPTIONS = [
  {
    value: "text_only" as AIGenerationMode,
    label: "Gerar textos",
    description: "Preenche títulos e textos nos templates existentes",
    icon: FileText,
  },
  {
    value: "full_layout" as AIGenerationMode,
    label: "Gerar site completo",
    description: "Cria layout + conteúdo do zero com IA",
    icon: LayoutTemplate,
  },
];

const SITE_MODE_OPTIONS = [
  {
    value: "single-page" as SiteMode,
    label: "Site one-page",
    description: "Tudo em uma página com scroll entre seções",
    icon: Globe,
  },
  {
    value: "multi-page" as SiteMode,
    label: "Site multi-página",
    description: "Páginas separadas: Home, Imóveis, Sobre, Contato",
    icon: FileStack,
  },
];

export function AIContentDialog({ open, onOpenChange, onGenerate, isGenerating, showLayoutOption = true }: Props) {
  const [mode, setMode] = useState<AIGenerationMode>("full_layout");
  const [siteMode, setSiteMode] = useState<SiteMode>("multi-page");
  const [answers, setAnswers] = useState<AIContentAnswers>({
    target_audience: "",
    differentials: "",
    tone: "profissional",
    region_focus: "",
    extra_info: "",
    reference_url: "",
  });

  const update = (key: keyof AIContentAnswers, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar conteúdo com IA
          </DialogTitle>
          <DialogDescription>
            Responda algumas perguntas para gerar textos mais personalizados para seu site.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode selector */}
          {showLayoutOption && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">O que deseja gerar?</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        mode === opt.value
                          ? "bg-primary/10 border-primary ring-1 ring-primary/30"
                          : "bg-background border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Site mode selector — only for full_layout */}
          {mode === "full_layout" && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Estilo do site</Label>
              <div className="grid grid-cols-2 gap-2">
                {SITE_MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSiteMode(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        siteMode === opt.value
                          ? "bg-primary/10 border-primary ring-1 ring-primary/30"
                          : "bg-background border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Target audience */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Qual é seu público-alvo?</Label>
            <Input
              placeholder="Ex: Famílias buscando casa própria, investidores, jovens casais..."
              value={answers.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
            />
          </div>

          {/* Differentials */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Quais são os diferenciais da sua imobiliária?</Label>
            <Textarea
              placeholder="Ex: 20 anos de mercado, atendimento personalizado, especialista em imóveis de luxo..."
              value={answers.differentials}
              onChange={(e) => update("differentials", e.target.value)}
              rows={2}
            />
          </div>

          {/* Tone */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Qual tom de comunicação você prefere?</Label>
            <div className="flex flex-wrap gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => update("tone", t.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    answers.tone === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Region focus */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Região de atuação principal</Label>
            <Input
              placeholder="Ex: Litoral de São Paulo, Zona Sul do Rio, Grande BH..."
              value={answers.region_focus}
              onChange={(e) => update("region_focus", e.target.value)}
            />
          </div>

          {/* Reference URL */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">URL de referência de estilo (opcional)</Label>
            <Input
              type="url"
              placeholder="Ex: https://www.imobiliariaxyz.com.br — cole o link de um site que goste do visual"
              value={answers.reference_url}
              onChange={(e) => update("reference_url", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A IA usará este site como inspiração para cores, layout e espaçamentos.
            </p>
          </div>

          {/* Extra info */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Algo mais que a IA deve saber? (opcional)</Label>
            <Textarea
              placeholder="Ex: Somos CRECI ativo, temos parceria com construtoras, foco em lançamentos..."
              value={answers.extra_info}
              onChange={(e) => update("extra_info", e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            onClick={() => onGenerate(answers, mode, mode === "full_layout" ? siteMode : undefined)}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "full_layout"
                  ? siteMode === "multi-page" ? "Gerando site multi-página..." : "Gerando site..."
                  : "Gerando textos..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {mode === "full_layout"
                  ? siteMode === "multi-page" ? "Gerar site multi-página" : "Gerar site completo"
                  : "Gerar textos"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
