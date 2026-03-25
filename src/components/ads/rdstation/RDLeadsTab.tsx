import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Inbox, Download, Users, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRDStationSettings } from "@/hooks/useRDStationSettings";
import RDSyncDialog from "./RDSyncDialog";

export default function RDLeadsTab() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const { hasOAuth } = useRDStationSettings();
  const [search, setSearch] = useState("");
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const queryClient = useQueryClient();

  const handleBackfillPhones = async () => {
    setIsBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-station-backfill-phones");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.updated || 0} leads atualizados com telefone!`);
      queryClient.invalidateQueries({ queryKey: ["rd-station-leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toastError("Erro ao atualizar telefones.", err, { module: "RDLeadsTab" });
    } finally {
      setIsBackfilling(false);
    }
  };

  const { data: rdLeads = [], isLoading } = useQuery({
    queryKey: ["rd-station-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, phone, source, temperature, created_at, notes")
        .eq("organization_id", orgId)
        .eq("external_source", "rdstation")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const filtered = search
    ? rdLeads.filter((l: any) =>
        [l.name, l.email, l.phone].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : rdLeads;

  const handleExportCSV = () => {
    if (rdLeads.length === 0) { toastError("Nenhum lead para exportar.", undefined, { module: "RDLeadsTab" }); return; }
    const headers = ["Nome", "E-mail", "Telefone", "Origem", "Temperatura", "Data", "Notas"];
    const rows = rdLeads.map((l: any) => [
      l.name || "", l.email || "", l.phone || "", l.source || "",
      l.temperature || "", l.created_at ? format(new Date(l.created_at), "dd/MM/yyyy HH:mm") : "",
      (l.notes || "").replace(/\n/g, " "),
    ]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_rdstation_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${rdLeads.length} leads exportados!`);
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasOAuth && (
            <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(true)}>
              <Users className="h-4 w-4 mr-1.5" /> Importar do RD
            </Button>
          )}
          {hasOAuth && rdLeads.some((l: any) => !l.phone) && (
            <Button variant="outline" size="sm" onClick={handleBackfillPhones} disabled={isBackfilling}>
              {isBackfilling ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Phone className="h-3.5 w-3.5 mr-1.5" />}
              {isBackfilling ? "Atualizando..." : "Puxar telefones"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={rdLeads.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV ({rdLeads.length})
          </Button>
        </div>
      </div>

      {/* Lead count */}
      {rdLeads.length > 0 && (
        <p className="text-sm text-muted-foreground">{filtered.length} lead{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Inbox className="h-12 w-12 text-muted-foreground/60" />
            <p className="text-muted-foreground text-sm">
              {search ? "Nenhum lead encontrado para essa busca." : "Nenhum lead do RD Station ainda."}
            </p>
            {!search && hasOAuth && (
              <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(true)}>
                <Users className="h-4 w-4 mr-1.5" /> Importar do RD Station
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead: any) => (
            <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm hover:bg-muted/50 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{lead.name || "Sem nome"}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {lead.email && <span className="truncate">{lead.email}</span>}
                  {lead.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {lead.phone}
                    </span>
                  )}
                  {!lead.phone && !lead.email && <span className="italic">Sem contato</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.temperature && (
                  <Badge variant="outline" className="text-xs">{lead.temperature}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <RDSyncDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen} />
    </div>
  );
}
