import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import {
  Search, Building2, Clock, Infinity, Plus, Minus, Loader2, User,
  ChevronDown, ChevronRight, Trash2, CreditCard, AlertTriangle
} from "lucide-react";
import { format, addMonths, addDays, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface OrgUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface OrgSubscription {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  trial_end: string | null;
}

interface PlanOption {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
}

interface OrgRow {
  id: string;
  name: string;
  is_active: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription: OrgSubscription | null;
  users: OrgUser[];
}

async function apiCall(method: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Não autenticado");
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-subscriptions`,
    {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Erro na operação");
  }
  return res.json();
}

export function SubscriptionsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["dev-org-subscriptions"],
    queryFn: () => apiCall("GET"),
  });

  const orgs: OrgRow[] = Array.isArray(data?.organizations) ? data.organizations : [];
  const plans: PlanOption[] = Array.isArray(data?.plans) ? data.plans : [];

  const updateMutation = useMutation({
    mutationFn: (body: any) => apiCall("PATCH", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-org-subscriptions"] });
      toast.success("Assinatura atualizada");
      setEditingId(null);
    },
    onError: (e: Error) => toastError("Erro na operação", e, { module: "SubscriptionsTab" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (orgId: string) => apiCall("DELETE", { org_id: orgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-org-subscriptions"] });
      toast.success("Organização removida");
    },
    onError: (e: Error) => toastError("Erro ao remover", e, { module: "SubscriptionsTab" }),
  });

  const getStatus = (org: OrgRow) => {
    if (org.subscription) {
      const s = org.subscription.status;
      if (s === "active") return "ativo";
      if (s === "trial") {
        const end = org.subscription.trial_end || org.trial_ends_at;
        if (end && new Date(end) > new Date()) return "trial";
        return "expirado";
      }
      if (s === "overdue") return "vencido";
      if (s === "cancelled") return "cancelado";
      return s;
    }
    if (!org.trial_ends_at) return "sem_plano";
    const end = new Date(org.trial_ends_at);
    if (end.getFullYear() >= 2099) return "ilimitado";
    if (end > new Date()) return "ativo";
    return "expirado";
  };

  const STATUS_LABELS: Record<string, string> = {
    sem_plano: "Sem plano", ilimitado: "Ilimitado", ativo: "Ativo",
    expirado: "Expirado", trial: "Trial", vencido: "Vencido", cancelado: "Cancelado",
  };

  const STATUS_COLORS: Record<string, string> = {
    sem_plano: "bg-muted text-muted-foreground",
    ilimitado: "bg-purple-500/10 text-purple-700 border-purple-200",
    ativo: "bg-green-500/10 text-green-700 border-green-200",
    expirado: "bg-red-500/10 text-red-700 border-red-200",
    trial: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    vencido: "bg-orange-500/10 text-orange-700 border-orange-200",
    cancelado: "bg-muted text-muted-foreground",
  };

  const adjustTime = (org: OrgRow, action: string) => {
    const current = org.trial_ends_at ? new Date(org.trial_ends_at) : new Date();
    const base = current < new Date() ? new Date() : current;
    let newEnd: Date;

    switch (action) {
      case "+1m": newEnd = addMonths(base, 1); break;
      case "+3m": newEnd = addMonths(base, 3); break;
      case "+6m": newEnd = addMonths(base, 6); break;
      case "+1y": newEnd = addYears(base, 1); break;
      case "unlimited": newEnd = new Date("2099-12-31T23:59:59Z"); break;
      case "-1m": newEnd = addMonths(current, -1); break;
      case "expire": newEnd = new Date(); break;
      case "custom": {
        const days = parseInt(customDays);
        if (isNaN(days)) { toastError("Informe um número válido de dias", undefined, { module: "SubscriptionsTab" }); return; }
        newEnd = addDays(base, days);
        break;
      }
      default: return;
    }

    updateMutation.mutate({
      org_id: org.id,
      trial_ends_at: newEnd!.toISOString(),
      trial_started_at: org.trial_started_at || new Date().toISOString(),
      current_period_end: newEnd!.toISOString(),
    });
  };

  const changePlan = (orgId: string, planId: string) => {
    updateMutation.mutate({
      org_id: orgId,
      plan_id: planId,
      status: "active",
      current_period_end: "2099-12-31T23:59:59Z",
    });
  };

  const toggleExpand = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId); else next.add(orgId);
      return next;
    });
  };

  const filtered = orgs.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      (o.subscription?.plan_name || "").toLowerCase().includes(q) ||
      STATUS_LABELS[getStatus(o)]?.toLowerCase().includes(q) ||
      o.users?.some(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    );
  });

  const emptyOrgs = orgs.filter(o => !o.users?.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar organização, plano ou usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline" className="shrink-0">{filtered.length} organizações</Badge>
        {emptyOrgs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Limpar {emptyOrgs.length} org{emptyOrgs.length !== 1 ? "s" : ""} vazia{emptyOrgs.length !== 1 ? "s" : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Remover organizações vazias?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Serão removidas {emptyOrgs.length} organização(ões) sem nenhum usuário vinculado. Esta ação não pode ser desfeita.
                  <div className="mt-3 max-h-40 overflow-y-auto space-y-1">
                    {emptyOrgs.map(o => (
                      <div key={o.id} className="text-xs text-muted-foreground">• {o.name}</div>
                    ))}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    for (const o of emptyOrgs) {
                      try { await apiCall("DELETE", { org_id: o.id }); } catch {}
                    }
                    queryClient.invalidateQueries({ queryKey: ["dev-org-subscriptions"] });
                    toast.success(`${emptyOrgs.length} organização(ões) removida(s)`);
                  }}
                >
                  Remover todas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((org) => {
            const status = getStatus(org);
            const isExpanded = expandedOrgs.has(org.id);
            const hasNoUsers = !org.users?.length;
            return (
              <Card key={org.id} className={hasNoUsers ? "border-dashed opacity-70" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {org.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {org.subscription && (
                        <Badge variant="outline" className="gap-1">
                          <CreditCard className="h-3 w-3" />
                          {org.subscription.plan_name}
                        </Badge>
                      )}
                      <Badge variant="outline" className={STATUS_COLORS[status] || ""}>{STATUS_LABELS[status] || status}</Badge>
                      {!org.is_active && <Badge variant="destructive">Inativa</Badge>}
                      <Badge variant="secondary">{(org.users?.length ?? 0)} usuário{(org.users?.length ?? 0) !== 1 ? "s" : ""}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Plano</p>
                      <p className="font-medium">{org.subscription?.plan_name || "Nenhum"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status assinatura</p>
                      <p className="font-medium capitalize">{org.subscription?.status || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Expira em</p>
                      <p className="font-medium">
                        {!org.trial_ends_at ? "—" : new Date(org.trial_ends_at).getFullYear() >= 2099 ? "♾️ Ilimitado" : format(new Date(org.trial_ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Período sub.</p>
                      <p className="font-medium">
                        {!org.subscription?.current_period_end ? "—" : new Date(org.subscription.current_period_end).getFullYear() >= 2099 ? "♾️" : format(new Date(org.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {/* Plan changer */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={org.subscription?.plan_id || ""}
                      onValueChange={(planId) => changePlan(org.id, planId)}
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder="Alterar plano..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.price_monthly > 0 ? `(R$${(p.price_monthly / 100).toFixed(2)})` : "(Grátis)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {hasNoUsers && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1">
                            <Trash2 className="h-3.5 w-3.5" /> Remover org
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover "{org.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>Esta organização não possui usuários. A remoção é permanente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(org.id)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  {/* Users collapsible */}
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(org.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <User className="h-3.5 w-3.5" />
                        Ver usuários ({org.users?.length ?? 0})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-border ml-2">
                        {!org.users?.length ? (
                          <p className="text-xs text-muted-foreground py-2">Nenhum usuário vinculado</p>
                        ) : (
                          org.users?.map((u) => (
                            <div key={u.user_id} className="flex items-center gap-3 py-1.5 px-2 rounded-md text-sm hover:bg-muted/50">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{u.full_name || "Sem nome"}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}{u.phone ? ` • ${u.phone}` : ""}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {editingId === org.id ? (
                    <div className="space-y-3 pt-2 border-t">
                      <p className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-4 w-4" /> Gerenciar tempo</p>
                      <div className="flex flex-wrap gap-2">
                        {[{ label: "1 mês", action: "+1m" }, { label: "3 meses", action: "+3m" }, { label: "6 meses", action: "+6m" }, { label: "1 ano", action: "+1y" }].map(({ label, action }) => (
                          <Button key={action} size="sm" variant="outline" onClick={() => adjustTime(org, action)} disabled={updateMutation.isPending}>
                            <Plus className="h-3 w-3 mr-1" /> {label}
                          </Button>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => adjustTime(org, "unlimited")} disabled={updateMutation.isPending}>
                          <Infinity className="h-3 w-3 mr-1" /> Ilimitado
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => adjustTime(org, "-1m")} disabled={updateMutation.isPending}>
                          <Minus className="h-3 w-3 mr-1" /> 1 mês
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => adjustTime(org, "expire")} disabled={updateMutation.isPending}>
                          Expirar agora
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 max-w-xs">
                        <Input type="number" placeholder="Dias (+/-)" value={customDays} onChange={(e) => setCustomDays(e.target.value)} className="w-28" />
                        <Button size="sm" variant="secondary" onClick={() => adjustTime(org, "custom")} disabled={updateMutation.isPending}>Aplicar</Button>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Fechar</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(org.id); setCustomDays(""); }}>
                      <Clock className="h-3.5 w-3.5 mr-1.5" /> Gerenciar tempo
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma organização encontrada.</p>}
        </div>
      )}
    </div>
  );
}
