import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTeamMembers } from "@/hooks/useTeamMembers";

interface Props {
  properties: any[];
}

export function MetricsDetailedPropertiesTable({ properties }: Props) {
  const { data: members } = useTeamMembers();
  const memberMap = new Map(members?.map(m => [m.user_id, m.full_name]));


  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">Título</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Lançamento</TableHead>
            <TableHead className="text-xs">Criado por</TableHead>
            <TableHead className="text-xs">Cadastro</TableHead>
            <TableHead className="text-xs text-right">Classificação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((p) => (
            <TableRow key={p.id} className="hover:bg-muted/30">
              <TableCell className="text-sm font-medium">{p.title || `Imóvel #${p.id.slice(0, 4)}`}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] h-5 capitalize">
                  {p.status || "disponivel"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm capitalize">{p.launch_stage || "nenhum"}</TableCell>
              <TableCell className="text-sm">{memberMap.get(p.created_by) || "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={p.status === "inativo" ? "destructive" : "default"} className="text-[10px] h-5">
                  {p.status === "inativo" ? "Inativo" : p.launch_stage === "futuro" ? "Futuro" : "Ativo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {properties.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                Nenhum imóvel encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
