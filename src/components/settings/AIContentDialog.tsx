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
import { Sparkles, Loader2 } from "lucide-react";

export interface AIContentAnswers {
  target_audience: string;
  differentials: string;
  tone: string;
  region_focus: string;
  extra_info: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (answers: AIContentAnswers) => void;
  isGenerating: boolean;
}

const TONE_OPTIONS = [
  { value: "profissional", label: "Profissional" },
  { value: "acolhedor", label: "Acolhedor" },
  { value: "luxo", label: "Luxo / Sofisticado" },
  { value: "jovem", label: "Jovem / Moderno" },
  { value: "tecnico", label: "Técnico / Informativo" },
];

export function AIContentDialog({ open, onOpenChange, onGenerate, isGenerating }: Props) {
  const [answers, setAnswers] = useState<AIContentAnswers>({
    target_audience: "",
    differentials: "",
    tone: "profissional",
    region_focus: "",
    extra_info: "",
  });

  const update = (key: keyof AIContentAnswers, value: string) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            onClick={() => onGenerate(answers)}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar conteúdo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
