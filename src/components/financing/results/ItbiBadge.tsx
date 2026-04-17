import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck, Shield, Info, AlertTriangle, ExternalLink } from "lucide-react";
import type { ItbiConfidence } from "@/lib/itbi/types";

const META: Record<
  ItbiConfidence,
  { label: string; tone: "success" | "info" | "warning" | "muted"; icon: React.ComponentType<{ className?: string }>; tip: string }
> = {
  oficial_validada: {
    label: "Oficial validada",
    tone: "success",
    icon: ShieldCheck,
    tip: "Regra municipal vigente confirmada com a fonte oficial.",
  },
  oficial: {
    label: "Oficial",
    tone: "info",
    icon: Shield,
    tip: "Regra municipal coletada de fonte oficial — recomendamos confirmação.",
  },
  estimativa_uf: {
    label: "Estimativa estadual",
    tone: "warning",
    icon: Info,
    tip: "Sem regra municipal cadastrada. Usando estimativa baseada no estado — confirme com a prefeitura.",
  },
  fallback: {
    label: "Estimativa nacional",
    tone: "warning",
    icon: AlertTriangle,
    tip: "Sem regra estadual ou municipal. Aplicando padrão nacional de 3% — apenas referência.",
  },
};

const TONE_CLASS: Record<string, string> = {
  success: "bg-green-500/10 text-green-500 border-green-500/30",
  info: "bg-primary/10 text-primary border-primary/30",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  muted: "bg-muted text-muted-foreground border-border",
};

interface Props {
  confidence: ItbiConfidence;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  className?: string;
}

export function ItbiBadge({ confidence, sourceLabel, sourceUrl, className }: Props) {
  const meta = META[confidence];
  const Icon = meta.icon;

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1 text-[10px] cursor-help ${TONE_CLASS[meta.tone]}`}
            >
              <Icon className="h-3 w-3" /> {meta.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-xs">
            {meta.tip}
          </TooltipContent>
        </Tooltip>

        {sourceLabel && (
          sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              {sourceLabel} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-[10px] text-muted-foreground">{sourceLabel}</span>
          )
        )}
      </div>
    </TooltipProvider>
  );
}
