import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertTriangle, CircleHelp } from "lucide-react";

interface PropertyReviewBadgeProps {
  lastReviewedAt: string | null | undefined;
  compact?: boolean;
}

type ReviewLevel = "today" | "fresh" | "warning" | "stale" | "never";

function getDaysSince(iso: string): number {
  const now = new Date();
  const then = new Date(iso);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function classify(lastReviewedAt: string | null | undefined): { level: ReviewLevel; days: number | null } {
  if (!lastReviewedAt) return { level: "never", days: null };
  const days = getDaysSince(lastReviewedAt);
  if (days <= 0) return { level: "today", days: 0 };
  if (days <= 30) return { level: "fresh", days };
  if (days <= 60) return { level: "warning", days };
  return { level: "stale", days };
}

function getLabel(level: ReviewLevel, days: number | null): string {
  if (level === "never") return "Nunca revisado";
  if (level === "today") return "Revisado hoje";
  return `Revisado há ${days} dia${days === 1 ? "" : "s"}`;
}

const config: Record<ReviewLevel, { className: string; dot: string; icon: typeof CheckCircle2 }> = {
  today: {
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    dot: "bg-green-500",
    icon: CheckCircle2,
  },
  fresh: {
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    dot: "bg-green-500",
    icon: CheckCircle2,
  },
  warning: {
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    dot: "bg-yellow-500",
    icon: Clock,
  },
  stale: {
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    dot: "bg-red-500",
    icon: AlertTriangle,
  },
  never: {
    className: "bg-muted text-muted-foreground border border-red-200 dark:border-red-900/40",
    dot: "bg-muted-foreground",
    icon: CircleHelp,
  },
};

export function PropertyReviewBadge({ lastReviewedAt, compact = false }: PropertyReviewBadgeProps) {
  const { level, days } = classify(lastReviewedAt);
  const label = getLabel(level, days);
  const cfg = config[level];
  const Icon = cfg.icon;

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.dot}`} aria-label={label} />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${cfg.className} gap-1`}>
          <Icon className="h-3 w-3" />
          {level === "never" ? "Nunca revisado" : level === "today" ? "Hoje" : `${days}d`}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Última revisão: {label.toLowerCase()}</TooltipContent>
    </Tooltip>
  );
}
