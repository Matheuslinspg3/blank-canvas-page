import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBrokers } from "@/hooks/useBrokers";

interface Props {
  leads: any[];
}

export function MetricsDetailedLeadsTable({ leads }: Props) {
  const { brokers } = useBrokers();
  const brokerMap = new Map(brokers.map(b => [b.user_id, b.full_name]));

  const normalizePhone = (p: string) => p?.replace(/\D/g, "") || "";
  const phoneCounts = new Map<string, number>();
  leads.forEach(l => {
    const p = normalizePhone(l.phone || "");
    if (p) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
  });

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">Nome</TableHead>
            <TableHead className="text-xs">Telefone</TableHead>
            <TableHead className="text-xs">Corretor</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Etapa</TableHead>
            <TableHead className="text-xs">Entrada</TableHead>
            <TableHead className="text-xs text-right">Duplicado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((l) => {
            const phone = normalizePhone(l.phone || "");
            const isDuplicate = phone ? (phoneCounts.get(phone) || 0) > 1 : false;
            
            return (
              <TableRow key={l.id} className="hover:bg-muted/30">
                <TableCell className="text-sm font-medium">{l.full_name || "Lead sem nome"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.phone || "—"}</TableCell>
                <TableCell className="text-sm">{brokerMap.get(l.broker_id) || "Sem corretor"}</TableCell>
                <TableCell>
                  <Badge variant={l.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                    {l.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{(l.lead_stages as any)?.name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-right">
                  {isDuplicate && (
                    <Badge variant="destructive" className="text-[10px] h-5">Sim</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {leads.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lead encontrado para os filtros aplicados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
