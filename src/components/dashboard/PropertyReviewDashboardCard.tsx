import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, ChevronRight, Home, CheckCircle2, RefreshCw, History } from "lucide-react";
import { usePropertyReviewSettings } from "@/hooks/usePropertyReviewSettings";
import { usePropertyReviewDashboard } from "@/hooks/usePropertyReviewDashboard";
import { usePropertyReview } from "@/hooks/usePropertyReview";

export function PropertyReviewDashboardCard() {
  const navigate = useNavigate();
  const { settings, isLoading: settingsLoading } = usePropertyReviewSettings();
  const enabled = !settingsLoading && settings.showDashboardCard;

  const { data, isLoading, error, refetch } = usePropertyReviewDashboard({ enabled, limit: 10 });
  const reviewMutation = usePropertyReview();

  if (!settings.showDashboardCard) return null;

  if (isLoading || settingsLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Controle de revisão</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </div>
          <CardDescription>Não foi possível carregar os imóveis para revisão.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const summary = data ?? {
    overdue_count: 0,
    never_count: 0,
    warning_count: 0,
    overdue_after_days: settings.overdueAfterDays,
    warning_before_days: settings.warningBeforeDays,
    critical: [],
  };

  const total = summary.overdue_count + summary.never_count + summary.warning_count;

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <CardTitle className="text-base">Controle de revisão de imóveis</CardTitle>
              <CardDescription>Todos os imóveis estão dentro do prazo de revisão.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const hasCritical = summary.overdue_count > 0 || summary.never_count > 0;

  return (
    <Card className={hasCritical ? "border-destructive/30" : "border-warning/30"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${hasCritical ? "bg-destructive/15" : "bg-warning/15"}`}>
              <AlertTriangle className={`h-4 w-4 ${hasCritical ? "text-destructive" : "text-warning"}`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">Controle de revisão de imóveis</CardTitle>
              <CardDescription>
                Limite de {summary.overdue_after_days} dias · aviso {summary.warning_before_days} dias antes
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {summary.overdue_count > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                {summary.overdue_count} desatualizado{summary.overdue_count > 1 ? "s" : ""}
              </Badge>
            )}
            {summary.never_count > 0 && (
              <Badge className="bg-muted text-muted-foreground border">
                {summary.never_count} nunca revisado{summary.never_count > 1 ? "s" : ""}
              </Badge>
            )}
            {summary.warning_count > 0 && (
              <Badge className="bg-warning/15 text-warning border-warning/30">
                {summary.warning_count} próximo{summary.warning_count > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {summary.critical.slice(0, 5).map((p) => {
          const priorityColor =
            p.priority === 1
              ? "text-muted-foreground"
              : p.priority === 2
              ? "text-destructive"
              : "text-warning";
          const priorityLabel =
            p.priority === 1
              ? "Nunca revisado"
              : p.priority === 2
              ? `${p.days_since ?? 0}d sem revisão`
              : `Faltam ~${Math.max(0, summary.overdue_after_days - (p.days_since ?? 0))}d`;

          return (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors group"
            >
              <button
                type="button"
                onClick={() => navigate(`/imoveis/${p.id}`)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">
                  {p.title || "Sem título"}
                  {p.property_code && (
                    <span className="ml-1.5 text-xs text-muted-foreground font-mono">#{p.property_code}</span>
                  )}
                </span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium flex items-center gap-1 ${priorityColor}`}>
                  <Clock className="h-3 w-3" />
                  {priorityLabel}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate(p.id)}
                  title="Marcar como revisado"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Revisado
                </Button>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            onClick={() => navigate("/imoveis?revisao=overdue_configured")}
          >
            <History className="h-3.5 w-3.5" />
            Ver todos desatualizados
          </Button>
          {summary.warning_count > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/imoveis?revisao=near_due")}
            >
              <Clock className="h-3.5 w-3.5" />
              Ver próximos do prazo
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
