import { Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AiCreditsBadge() {
  const { getAiCreditsLimit } = useSubscription();
  const limit = getAiCreditsLimit();

  if (limit === 0) return null;

  const limitLabel = limit === Infinity ? "Ilimitado" : `${limit}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary cursor-default select-none">
            <Sparkles className="h-3.5 w-3.5" />
            <span>IA: {limitLabel} créditos/mês</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Créditos de IA disponíveis no seu plano</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
