import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Download, CheckCircle2, RefreshCw, Users, CalendarIcon, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RDContact {
  uuid: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  tags: string[];
  created_at: string | null;
  existsInCRM: boolean;
  existingLeadId: string | null;
}

interface RDSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RDSyncDialog({ open, onOpenChange }: RDSyncDialogProps) {
  const [contacts, setContacts] = useState<RDContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeExisting, setMergeExisting] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const queryClient = useQueryClient();

  const filteredContacts = useMemo(() => {
    if (!dateFrom && !dateTo) return contacts;
    return contacts.filter(c => {
      if (!c.created_at) return true; // show contacts without date
      const d = new Date(c.created_at);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [contacts, dateFrom, dateTo]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-station-list-contacts");
      if (error) throw error;
      if (data?.error) {
        if (data.needs_oauth) {
          toastError("Conecte sua conta RD Station via OAuth primeiro.", undefined, { module: "RDSyncDialog" });
          return;
        }
        throw new Error(data.error);
      }
      const contactList = data.contacts || [];
      setContacts(contactList);
      setFetched(true);
      const newIds = new Set<string>();
      contactList.forEach((c: RDContact) => {
        if (!c.existsInCRM && c.uuid) newIds.add(c.uuid);
      });
      setSelectedIds(newIds);
    } catch (err: any) {
      toastError("Erro ao buscar contatos do RD Station.", err, { module: "RDSyncDialog" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleContact = (uuid: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleAll = (onlyNew: boolean) => {
    const filtered = filteredContacts.filter(c => c.uuid && (onlyNew ? !c.existsInCRM : true));
    const allSelected = filtered.every(c => selectedIds.has(c.uuid!));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.delete(c.uuid!));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(c => next.add(c.uuid!));
        return next;
      });
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Selecione ao menos um contato para importar.");
      return;
    }
    setIsImporting(true);
    try {
      const selectedContacts = contacts.filter(c => c.uuid && selectedIds.has(c.uuid));
      const { data, error } = await supabase.functions.invoke("rd-station-sync-leads", {
        body: {
          selective: true,
          contact_uuids: selectedContacts.map(c => c.uuid),
          merge_existing: mergeExisting,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Importação concluída: ${data.created || 0} criados, ${data.updated || 0} atualizados, ${data.duplicates || 0} duplicados.`
      );
      queryClient.invalidateQueries({ queryKey: ["leads"], refetchType: "active" });
      queryClient.invalidateQueries({ queryKey: ["rd-station-logs"] });
      onOpenChange(false);
    } catch (err: any) {
      toastError("Erro ao importar leads.", err, { module: "RDSyncDialog" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setContacts([]);
    setFetched(false);
    setSelectedIds(new Set());
    setMergeExisting(false);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const newContacts = filteredContacts.filter(c => !c.existsInCRM);
  const existingContacts = filteredContacts.filter(c => c.existsInCRM);
  const selectedNew = newContacts.filter(c => c.uuid && selectedIds.has(c.uuid)).length;
  const selectedExisting = existingContacts.filter(c => c.uuid && selectedIds.has(c.uuid)).length;

  const formatContactDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sincronizar Leads do RD Station
          </DialogTitle>
          <DialogDescription>
            Escolha quais contatos deseja importar para o CRM.
          </DialogDescription>
        </DialogHeader>

        {!fetched ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Clique abaixo para buscar a lista de contatos disponíveis no RD Station.
            </p>
            <Button onClick={fetchContacts} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Buscando contatos..." : "Buscar Contatos"}
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="gap-1">
                {filteredContacts.length} contatos
              </Badge>
              <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-0">
                {newContacts.length} novos
              </Badge>
              <Badge variant="secondary" className="gap-1">
                {existingContacts.length} já existem
              </Badge>
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filtrar por período:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-8", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-8", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  Limpar filtro
                </Button>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                  {newContacts.length > 0 && newContacts.every(c => c.uuid && selectedIds.has(c.uuid)) ? "Desmarcar novos" : "Selecionar todos novos"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                  {filteredContacts.length > 0 && filteredContacts.every(c => c.uuid && selectedIds.has(c.uuid!)) ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="merge-existing"
                  checked={mergeExisting}
                  onCheckedChange={(v) => setMergeExisting(!!v)}
                />
                <label htmlFor="merge-existing" className="text-xs text-muted-foreground cursor-pointer">
                  Atualizar dados de leads existentes
                </label>
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 border rounded-lg max-h-[400px] overflow-y-auto">
              <div className="divide-y divide-border">
                {filteredContacts.map((contact) => {
                  const key = contact.uuid || contact.email || contact.name;
                  const isSelected = contact.uuid ? selectedIds.has(contact.uuid) : false;
                  const dateFormatted = formatContactDate(contact.created_at);
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                        contact.existsInCRM ? 'bg-muted/30' : ''
                      }`}
                      onClick={() => contact.uuid && toggleContact(contact.uuid)}
                    >
                      <Checkbox
                        checked={isSelected}
                        className="shrink-0"
                        onCheckedChange={() => contact.uuid && toggleContact(contact.uuid)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{contact.name}</span>
                          {contact.existsInCRM && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0 shrink-0">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Já existe
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {contact.email && (
                            <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                          )}
                          {contact.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Phone className="h-2.5 w-2.5" />
                              {contact.phone}
                            </span>
                          )}
                          {dateFormatted && (
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                              <CalendarIcon className="h-2.5 w-2.5" />
                              {dateFormatted}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum contato encontrado no período selecionado.
                  </div>
                )}
              </div>
            </div>

            {/* Import button */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {selectedNew} novos + {selectedExisting} existentes selecionados
              </span>
              <Button onClick={handleImport} disabled={isImporting || selectedIds.size === 0}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isImporting ? "Importando..." : `Importar ${selectedIds.size} contatos`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
