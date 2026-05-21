import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeadStages } from "@/hooks/useLeadStages";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, CalendarIcon, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface MetaLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_time: string;
  status: string;
  form_name: string;
  page_name: string;
  is_in_crm?: boolean;
  crm_record_id?: string | null;
}

type PeriodOption = "1d" | "7d" | "30d" | "custom";

export default function MetaLeadImport() {
  const { toast } = useToast();
  const { leadStages } = useLeadStages();

  const [period, setPeriod] = useState<PeriodOption>("7d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stageId, setStageId] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const getDaysBack = (): number => {
    if (period === "1d") return 1;
    if (period === "7d") return 7;
    if (period === "30d") return 30;
    if (period === "custom" && customRange?.from) {
      const to = customRange.to || new Date();
      return Math.min(differenceInDays(to, customRange.from) + 1, 90);
    }
    return 7;
  };

  const handleFetchLeads = async () => {
    setIsFetching(true);
    setLeads([]);
    setSelectedIds(new Set());
    setHasFetched(false);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-leads", {
        body: { mode: "preview", days_back: getDaysBack() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fetched: MetaLead[] = data?.leads || [];
      setLeads(fetched);
      setHasFetched(true);
      
      // Auto-select only truly new leads (not in CRM)
      setSelectedIds(new Set(fetched.filter(l => !l.is_in_crm).map(l => l.id)));

      if (fetched.length === 0) {
        toast({ title: "Nenhum lead novo", description: data?.message || "Não foram encontrados leads novos nesse período." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar leads", description: err.message, variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-leads", {
        body: {
          mode: "import",
          selected_lead_ids: Array.from(selectedIds),
          crm_stage_id: stageId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Leads importados!",
        description: `${data.imported} importados, ${data.duplicates} duplicados/ignorados.`,
      });

      // Remove imported from list
      setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectableLeads = leads.filter(l => !l.is_in_crm);
    if (selectedIds.size === selectableLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableLeads.map((l) => l.id)));
    }
  };

  const isCustomValid = period !== "custom" || (customRange?.from != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Importar Leads do Meta Ads
        </CardTitle>
        <CardDescription>Busque leads por período e selecione quais importar para o CRM.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period selector */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Último dia</SelectItem>
                <SelectItem value="7d">Última semana</SelectItem>
                <SelectItem value="30d">Último mês</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[260px] justify-start text-left font-normal", !customRange?.from && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange?.from ? (
                    customRange.to ? (
                      `${format(customRange.from, "dd/MM/yy")} – ${format(customRange.to, "dd/MM/yy")}`
                    ) : (
                      format(customRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    "Selecione o período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={1}
                  locale={ptBR}
                  disabled={(date) => date > new Date() || date < new Date(Date.now() - 90 * 86400000)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button onClick={handleFetchLeads} disabled={isFetching || !isCustomValid}>
            {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Leads
          </Button>
        </div>

        {/* Results */}
        {hasFetched && leads.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-4 text-sm">
                <p className="text-muted-foreground">
                  Total: <strong>{leads.length}</strong>
                </p>
                <p className="text-green-600 font-medium">
                  Novos: <strong>{leads.filter(l => !l.is_in_crm).length}</strong>
                </p>
                <p className="text-blue-600 font-medium">
                  No CRM: <strong>{leads.filter(l => l.is_in_crm).length}</strong>
                </p>
              </div>
              {selectedIds.size > 0 && (
                <p className="text-sm font-semibold">
                  {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""} para importar
                </p>
              )}
            </div>

            <div className="border rounded-md overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={leads.length > 0 && leads.filter(l => !l.is_in_crm).length > 0 && selectedIds.size === leads.filter(l => !l.is_in_crm).length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Formulário</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className={cn("cursor-pointer", lead.is_in_crm && "bg-muted/30 opacity-80")} 
                      onClick={() => !lead.is_in_crm && toggleSelect(lead.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => !lead.is_in_crm && toggleSelect(lead.id)}
                          disabled={lead.is_in_crm}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        {lead.is_in_crm ? (
                          <Badge variant="outline" className="text-[10px] uppercase bg-blue-50 text-blue-700 border-blue-200">
                            No CRM
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase bg-green-50 text-green-700 border-green-200">
                            Novo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                      <TableCell className="text-sm">{lead.email || "—"}</TableCell>
                      <TableCell className="text-sm">{lead.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-normal">{lead.form_name}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(lead.created_time), "dd/MM/yy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Import controls */}
            <div className="flex flex-wrap items-end gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Estágio no CRM</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleImport} disabled={isImporting || selectedIds.size === 0}>
                {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </Button>
            </div>
          </>
        )}

        {hasFetched && leads.length === 0 && !isFetching && (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lead novo encontrado nesse período.</p>
        )}
      </CardContent>
    </Card>
  );
}
