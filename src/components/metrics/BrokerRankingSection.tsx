import { UserCog, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MetricsDateRange } from "@/hooks/useMetricsData";
import { useBrokerMetrics } from "@/hooks/useMetricsData";

interface Props {
  dateRange: MetricsDateRange;
}

export function BrokerRankingSection({ dateRange }: Props) {
  const { data: brokers, isLoading } = useBrokerMetrics(dateRange);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <UserCog className="h-5 w-5 text-accent" />
        Ranking de Corretores
      </h2>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" /> Top Corretores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !brokers || brokers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum corretor com dados no período.</p>
          ) : (
            <div className="space-y-2">
              {brokers.slice(0, 10).map((broker, idx) => (
                <div
                  key={broker.brokerId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                    {idx + 1}º
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={broker.avatar || undefined} />
                    <AvatarFallback className="text-xs bg-accent/10 text-accent">
                      {broker.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{broker.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {broker.leadsCount} leads · {broker.wonCount} ganhos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-accent">
                      {broker.conversionRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">conversão</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
