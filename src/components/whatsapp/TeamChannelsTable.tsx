import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WifiOff, Wifi, Loader2, User } from "lucide-react";
import { useTeamChannels } from "@/hooks/whatsapp/useBrokerChannel";
import { useBrokerChannel } from "@/hooks/whatsapp/useBrokerChannel";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TeamChannelsTable() {
  const { data: channels, isLoading } = useTeamChannels();
  const { disconnect, isDisconnecting } = useBrokerChannel();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (!channels?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <User className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">Nenhum corretor conectou seu WhatsApp ainda</p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    if (status === "connected") return <Badge variant="default" className="gap-1"><Wifi className="h-3 w-3" />Conectado</Badge>;
    if (status === "connecting") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Conectando</Badge>;
    return <Badge variant="destructive" className="gap-1"><WifiOff className="h-3 w-3" />Desconectado</Badge>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Corretor</TableHead>
          <TableHead>Número</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Conectado em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((ch: any) => {
          const profileData = ch.profiles;
          const name = profileData?.full_name ?? "Sem nome";
          const phone = ch.phone_number
            ? ch.phone_number.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4")
            : "—";

          return (
            <TableRow key={ch.id}>
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell className="text-muted-foreground">{phone}</TableCell>
              <TableCell>{statusBadge(ch.status)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {ch.created_at
                  ? formatDistanceToNow(new Date(ch.created_at), { addSuffix: true, locale: ptBR })
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                {ch.status !== "disconnected" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDisconnecting}
                    onClick={() => disconnect(ch.user_id)}
                    className="text-destructive hover:text-destructive gap-1.5"
                  >
                    <WifiOff className="h-3.5 w-3.5" />
                    Desconectar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
