import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertTriangle, CircleHelp } from "lucide-react";
import {
  classifyReview,
  DEFAULT_REVIEW_SETTINGS,
  type PropertyReviewSettings,
} from "@/hooks/usePropertyReviewSettings";

interface PropertyReviewBadgeProps {
  lastReviewedAt: string | null | undefined;
  /**
   * Optional review configuration. If omitted the badge falls back to
   * DEFAULT_REVIEW_SETTINGS (60/15/true). The badge intentionally does NOT
   * call any hook to avoid N+1 queries when rendered inside lists.
   * Pages should fetch settings once with `usePropertyReviewSettings()` and
   * pass the same object down to each badge instance.
   */
  settings?: PropertyReviewSettings;
  compact?: boolean;
}

type Level = "today" | "fresh" | "near_due" | "overdue" | "never";

function getDaysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function resolveLevel(
  lastReviewedAt: string | null | undefined,
  s: PropertyReviewSettings,
): { level: Level; days: number | null } {
  const cls = classifyReview(lastReviewedAt, s);
  if (cls === "never") return { level: "never", days: null };
  const days = getDaysSince(lastReviewedAt as string);
  if (cls === "fresh" && days <= 0) return { level: "today", days: 0 };
  if (cls === "fresh") return { level: "fresh", days };
  if (cls === "near_due") return { level: "near_due", days };
  return { level: "overdue", days };
}

function getLabel(level: Level, days: number | null): string {
  if (level === "never") return "Nunca revisado";
  if (level === "today") return "Revisado hoje";
  return `Revisado há ${days} dia${days === 1 ? "" : "s"}`;
}

const config: Record<Level, { className: string; dot: string; icon: typeof CheckCircle2 }> = {
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
  near_due: {
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    dot: "bg-yellow-500",
    icon: Clock,
  },
  overdue: {
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

export function PropertyReviewBadge({
  lastReviewedAt,
  settings = DEFAULT_REVIEW_SETTINGS,
  compact = false,
}: PropertyReviewBadgeProps) {
  const { level, days } = resolveLevel(lastReviewedAt, settings);
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
