import { UserCog, Trophy, UserCheck, UserMinus, PhoneOff, Home, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MetricsDateRange, MetricsFilters } from "@/hooks/useMetricsData";
import { useBrokerRankingMetrics } from "@/hooks/useMetricsData";

interface Props {
  dateRange: MetricsDateRange;
  filters: MetricsFilters;
}

export function BrokerRankingSection({ dateRange, filters }: Props) {
  const { data: brokers, isLoading } = useBrokerRankingMetrics(dateRange, filters);

  return (
    <section className="space-y-4" id="section-brokers">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <UserCog className="h-5 w-5 text-accent" />
        Produtividade de Corretores
      </h2>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !brokers || brokers.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center">Nenhum corretor com dados no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[250px] text-xs">Corretor</TableHead>
                    <TableHead className="text-center text-xs">Leads</TableHead>
                    <TableHead className="text-center text-xs">Ativos</TableHead>
                    <TableHead className="text-center text-xs">Inativos</TableHead>
                    <TableHead className="text-center text-xs">Duplicados</TableHead>
                    <TableHead className="text-center text-xs">Imóveis (Criados)</TableHead>
                    <TableHead className="text-center text-xs">Imóveis (Inativos)</TableHead>
                    <TableHead className="text-right text-xs">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokers.map((broker) => (
                    <TableRow key={broker.brokerId} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={broker.avatar || undefined} />
                            <AvatarFallback className="text-xs bg-accent/10 text-accent">
                              {broker.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm">{broker.name}</span>
                            {broker.brokerId === "none" && (
                              <span className="text-[10px] text-orange-500 font-medium">Atenção necessária</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-semibold">{broker.leads}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-green-600 font-medium flex items-center justify-center gap-1">
                          <UserCheck className="h-3 w-3" /> {broker.active}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                          <UserMinus className="h-3 w-3" /> {broker.inactive}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-orange-500 flex items-center justify-center gap-1">
                          <PhoneOff className="h-3 w-3" /> {broker.duplicates}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs flex items-center justify-center gap-1">
                          <Home className="h-3 w-3 text-accent" /> {broker.propertiesCreated}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-destructive flex items-center justify-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {broker.propertiesInactive}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-bold text-accent">
                          {broker.participation.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

