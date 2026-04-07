import { CheckCircle2, Layout, Sparkles, PenLine, Columns3, Diamond, Zap, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SiteTemplate = "classic" | "modern" | "elegant" | "bold" | "minimal";

interface TemplateOption {
  id: SiteTemplate;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: string; // CSS gradient for preview
}

const templates: TemplateOption[] = [
  {
    id: "classic",
    name: "Clássico",
    description: "Nav no topo, hero com gradiente centralizado, grid 3 colunas",
    icon: Layout,
    preview: "linear-gradient(135deg, #1E293B 0%, #3B82F6 100%)",
  },
  {
    id: "modern",
    name: "Moderno",
    description: "Nav fixa com blur, hero escuro lateral, cards horizontais, contato dividido",
    icon: Columns3,
    preview: "linear-gradient(180deg, #111827 0%, #1F2937 60%, #F9FAFB 100%)",
  },
  {
    id: "elegant",
    name: "Elegante",
    description: "Nav fina com serif, hero minimalista, grid 2 colunas, sobre em citação",
    icon: Diamond,
    preview: "linear-gradient(180deg, #FFFFFF 0%, #F5F0EB 50%, #D4AF37 100%)",
  },
  {
    id: "bold",
    name: "Impactante",
    description: "Nav flutuante pill, hero gigante colorido, formas geométricas, contato escuro",
    icon: Zap,
    preview: "linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%)",
  },
  {
    id: "minimal",
    name: "Minimalista",
    description: "Nav flutuante embaixo, hero branco limpo, imóveis em lista, ultra clean",
    icon: Minus,
    preview: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 50%, #F1F5F9 100%)",
  },
];

interface Props {
  value: SiteTemplate;
  onChange: (template: SiteTemplate) => void;
  onGenerateWithAI?: () => void;
  isGenerating?: boolean;
}

export function SiteTemplateSelector({ value, onChange, onGenerateWithAI, isGenerating }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layout className="h-5 w-5" />
          Template do Site
        </CardTitle>
        <CardDescription>Escolha o estilo visual do seu site</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {templates.map((t) => {
            const Icon = t.icon;
            const isSelected = value === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={cn(
                  "relative group flex flex-col rounded-lg border-2 overflow-hidden transition-all text-left",
                  isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                )}
              >
                {/* Preview thumbnail */}
                <div className="h-20 w-full relative" style={{ background: t.preview }}>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 bg-primary rounded-full p-0.5">
                      <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">{t.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                </div>
              </button>
            );
          })}

          {/* AI Generate card */}
          {onGenerateWithAI && (
            <button
              onClick={onGenerateWithAI}
              disabled={isGenerating}
              className={cn(
                "relative flex flex-col rounded-lg border-2 border-dashed overflow-hidden transition-all text-left",
                "border-primary/30 hover:border-primary/60 bg-primary/5",
                isGenerating && "opacity-60 pointer-events-none"
              )}
            >
              <div className="h-20 w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Criar com IA</span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">IA</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isGenerating ? "Gerando conteúdo..." : "Gere textos automaticamente"}
                </p>
              </div>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
