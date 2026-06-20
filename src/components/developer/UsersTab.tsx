import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChangeRole } from "@/hooks/useTeamMembers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { 
  Trash2, AlertTriangle, Users, Search, KeyRound, Loader2, Plus, X, 
  ExternalLink, Eye, Filter, Calendar, Building2, CreditCard, Clock, 
  CheckCircle2, Globe, MessageSquare, Briefcase, MousePointer2, Info,
  Smartphone
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ALL_ROLES = ["developer", "admin", "sub_admin", "leader", "corretor", "assistente"] as const;

const roleLabel: Record<string, string> = {
  developer: "Developer",
  admin: "Admin",
  sub_admin: "Sub-Admin",
  leader: "Leader",
  corretor: "Corretor",
  assistente: "Assistente",
};

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "developer": return "destructive" as const;
    case "admin": return "default" as const;
    case "leader": return "default" as const;
    default: return "secondary" as const;
  }
};

interface PaymentAttempt {
  id: string;
  user_id: string;
  plan_name: string;
  amount_cents: number;
  billing_cycle: string;
  status: string;
  created_at: string;
  attribution_context?: any;
}

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: any;
  payment_attempts?: PaymentAttempt[];
}

export function UsersTab() {
  const queryClient = useQueryClient();
  const changeRole = useChangeRole();
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOnboarding, setFilterOnboarding] = useState<string>("all");
  const [passwordTarget, setPasswordTarget] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  // Criação de conta administrativa (Opção B): onboarding sem fricção p/ demo/venda.
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAccount, setNewAccount] = useState({ email: "", password: "", full_name: "", reason: "" });
  const [updatingRoles, setUpdatingRoles] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: allRoles = [] } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["all-profiles-dev"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, organization_id, onboarding_completed");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: authUsers = [], isLoading: isLoadingAuth } = useQuery({
    queryKey: ["admin-users-emails"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<AuthUser[]>;
    },
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ["dev-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, trial_started_at, trial_ends_at, is_active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["dev-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("organization_id, plan_id, status, trial_end");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["dev-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, slug");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: websiteSettings = [] } = useQuery({
    queryKey: ["dev-website-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_settings")
        .select("organization_id, custom_domain, is_active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: whatsappInstances = [] } = useQuery({
    queryKey: ["dev-whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("organization_id, status");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: orgUsage = [] } = useQuery({
    queryKey: ["dev-org-usage-sync"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_org_usage");
      if (error) return [];
      return data as any[];
    },
  });

  const getEmail = (userId: string) => authUsers.find((u) => u.id === userId)?.email || "—";
  const getAuthUser = (userId: string) => authUsers.find((u) => u.id === userId);
  
  const filtered = useMemo(() => {
    return allProfiles.filter(p => {
      const email = getEmail(p.user_id);
      const authUser = getAuthUser(p.user_id);
      const org = organizations.find(o => o.id === p.organization_id);
      const sub = subscriptions.find(s => s.organization_id === p.organization_id);
      
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch = 
          p.full_name?.toLowerCase().includes(s) || 
          email.toLowerCase().includes(s) || 
          p.user_id.toLowerCase().includes(s) ||
          p.phone?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }

      // Org filter
      if (filterOrg !== "all" && p.organization_id !== filterOrg) return false;

      // Plan filter
      if (filterPlan !== "all") {
        if (filterPlan === "none" && sub) return false;
        if (filterPlan !== "none" && sub?.plan_id !== filterPlan) return false;
      }

      // Status filter
      if (filterStatus !== "all" && sub?.status !== filterStatus) return false;

      // Onboarding filter
      if (filterOnboarding !== "all") {
        const completed = !!p.onboarding_completed;
        if (filterOnboarding === "completed" && !completed) return false;
        if (filterOnboarding === "pending" && completed) return false;
      }

      return true;
    }).sort((a, b) => {
      const aAt = getAuthUser(a.user_id)?.created_at ?? "";
      const bAt = getAuthUser(b.user_id)?.created_at ?? "";
      return bAt.localeCompare(aAt); // mais recente primeiro
    });
  }, [allProfiles, authUsers, organizations, subscriptions, search, filterOrg, filterPlan, filterStatus, filterOnboarding]);

  const toggleRole = async (userId: string, role: string, currentRoles: typeof allRoles) => {
    setUpdatingRoles(userId);
    try {
      const existing = currentRoles.find(r => r.role === role);
      if (existing) {
        changeRole.mutate({ userId, newRole: "corretor" }, {
          onSettled: () => setUpdatingRoles(null),
        });
      } else {
        changeRole.mutate({ userId, newRole: role }, {
          onSettled: () => setUpdatingRoles(null),
        });
      }
    } catch (e) {
      toast({ title: "Erro ao alterar cargo", description: (e as Error).message, variant: "destructive" });
      setUpdatingRoles(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterOrg("all");
    setFilterPlan("all");
    setFilterStatus("all");
    setFilterOnboarding("all");
  };

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <Card>
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Filtros Avançados</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="relative col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, Email, ID, Telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Orgs</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Planos</SelectItem>
                <SelectItem value="none">Sem Plano</SelectItem>
                {plans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status Assinatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="past_due">Atrasado</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
                <SelectItem value="incomplete">Incompleto</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterOnboarding} onValueChange={setFilterOnboarding}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Onboarding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status Onboarding</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="h-9 gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuários do Sistema
              </CardTitle>
              <CardDescription>
                {filtered.length} usuários encontrados
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="default" size="sm" onClick={() => setCreateOpen(true)} className="h-8 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Criar conta
              </Button>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="h-8 gap-1.5">
                <Loader2 className={`h-3.5 w-3.5 ${isLoadingAuth || isLoadingProfiles ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {/* Dialog: criar conta já com e-mail confirmado (Opção B) */}
            <AlertDialog open={createOpen} onOpenChange={(o) => { if (!o && !creating) { setCreateOpen(false); setNewAccount({ email: "", password: "", full_name: "", reason: "" }); } }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Criar conta</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cria uma conta já com o e-mail confirmado — o usuário entra direto, sem precisar verificar e-mail. Ação registrada em auditoria.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">E-mail <span className="text-destructive">*</span></label>
                    <Input type="email" placeholder="cliente@email.com" value={newAccount.email} onChange={e => setNewAccount(s => ({ ...s, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Senha provisória <span className="text-destructive">*</span></label>
                    <Input type="text" placeholder="Mín. 6 caracteres" value={newAccount.password} onChange={e => setNewAccount(s => ({ ...s, password: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Combine com o usuário para ele trocar depois.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nome completo</label>
                    <Input type="text" placeholder="Opcional" value={newAccount.full_name} onChange={e => setNewAccount(s => ({ ...s, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Motivo</label>
                    <Input type="text" placeholder="Ex: cliente travado na verificação / demo de venda" value={newAccount.reason} onChange={e => setNewAccount(s => ({ ...s, reason: e.target.value }))} />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={creating}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={creating || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAccount.email.trim()) || newAccount.password.length < 6}
                    onClick={async (e) => {
                      e.preventDefault();
                      setCreating(true);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                          body: JSON.stringify({
                            email: newAccount.email.trim(),
                            password: newAccount.password,
                            full_name: newAccount.full_name.trim(),
                            reason: newAccount.reason.trim(),
                          }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json?.error || "Falha ao criar conta");
                        toast({ title: "Conta criada", description: `${newAccount.email.trim()} já pode entrar (e-mail confirmado).` });
                        setCreateOpen(false);
                        setNewAccount({ email: "", password: "", full_name: "", reason: "" });
                        queryClient.invalidateQueries();
                      } catch (err) {
                        toast({ variant: "destructive", title: "Erro", description: err instanceof Error ? err.message : "Falha ao criar conta" });
                      } finally {
                        setCreating(false);
                      }
                    }}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Usuário / ID</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Comercial</TableHead>
                <TableHead className="text-center">Uso</TableHead>
                <TableHead className="text-center">Site/Zap</TableHead>
                <TableHead>Cadastro / Acesso</TableHead>
                <TableHead className="pr-6 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const userRoles = allRoles.filter((r) => r.user_id === p.user_id);
                const email = getEmail(p.user_id);
                const authUser = getAuthUser(p.user_id);
                const isUpdating = updatingRoles === p.user_id;
                
                const org = organizations.find(o => o.id === p.organization_id);
                const sub = subscriptions.find(s => s.organization_id === p.organization_id);
                const plan = plans.find(pl => pl.id === sub?.plan_id);
                const usage = orgUsage.find(u => u.id === p.organization_id);
                const site = websiteSettings.find(ws => ws.organization_id === p.organization_id);
                const whatsapp = whatsappInstances.find(wi => wi.organization_id === p.organization_id);

                return (
                  <TableRow key={p.user_id} className="group">
                    <TableCell className="pl-6">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{p.full_name || "Sem nome"}</p>
                          {p.onboarding_completed && (
                            <span title="Onboarding concluído">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-none">{email}</p>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground/60 font-mono hover:text-foreground transition-colors cursor-pointer w-fit mt-1"
                          onClick={() => {
                            navigator.clipboard.writeText(p.user_id);
                            toast({ title: "ID copiado!" });
                          }}
                        >
                          {p.user_id}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org ? (
                        <div className="flex flex-col gap-0.5">
                          <p className="text-sm font-medium">{org.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{org.slug || "sem-slug"}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem org</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={sub?.status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-4.5 px-1.5">
                            {plan?.name || "Sem plano"}
                          </Badge>
                          {sub?.status === 'trial' && (
                            <Badge variant="outline" className="text-[10px] h-4.5 border-orange-200 text-orange-600 bg-orange-50">Trial</Badge>
                          )}
                        </div>
                        {sub?.status && sub.status !== 'active' && sub.status !== 'trial' && (
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">{sub.status}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold">{usage?.total_properties || 0}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">Imóveis</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold">{usage?.total_leads || 0}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">Leads</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span title={site?.custom_domain || "Sem domínio"}>
                          <Globe className={`h-4 w-4 ${site?.is_active ? 'text-primary' : 'text-muted-foreground/30'}`} />
                        </span>
                        <span title={whatsapp?.status || "Desconectado"}>
                          <MessageSquare className={`h-4 w-4 ${whatsapp?.status === 'connected' ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {authUser?.created_at ? format(new Date(authUser.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {authUser?.last_sign_in_at ? format(new Date(authUser.last_sign_in_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "Nunca"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Sheet open={selectedUser === p.user_id} onOpenChange={(open) => setSelectedUser(open ? p.user_id : null)}>
                          <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="sm:max-w-xl overflow-y-auto">
                            <SheetHeader className="pb-6 border-b">
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                                  {p.full_name?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <SheetTitle>{p.full_name}</SheetTitle>
                                  <SheetDescription className="flex flex-col">
                                    <span>{email}</span>
                                    <span className="font-mono text-[10px]">{p.user_id}</span>
                                  </SheetDescription>
                                </div>
                              </div>
                            </SheetHeader>

                            <div className="py-6 space-y-8">
                              {/* Seção de Perfil e Cargos */}
                              <section className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                  <Briefcase className="h-4 w-4" /> Perfil e Acesso
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cargos Atuais</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {userRoles.map((r) => (
                                        <Badge key={r.id} variant={roleBadgeVariant(r.role)} className="gap-1 pr-1">
                                          {roleLabel[r.role] || r.role}
                                          <X className="h-3 w-3 cursor-pointer" onClick={() => !isUpdating && toggleRole(p.user_id, r.role, userRoles)} />
                                        </Badge>
                                      ))}
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-full" disabled={isUpdating}>
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-2">
                                          {ALL_ROLES.map((role) => (
                                            <label key={role} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer text-sm">
                                              <Checkbox checked={userRoles.some(r => r.role === role)} onCheckedChange={() => toggleRole(p.user_id, role, userRoles)} />
                                              {roleLabel[role]}
                                            </label>
                                          ))}
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Telefone</p>
                                    <p className="text-sm flex items-center gap-1.5">
                                      <Smartphone className="h-3.5 w-3.5" />
                                      {p.phone || "Não informado"}
                                    </p>
                                  </div>
                                </div>
                              </section>

                              {/* Seção Comercial */}
                              <section className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                  <CreditCard className="h-4 w-4" /> Dados Comerciais
                                </h3>
                                <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 gap-6">
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Plano Atual</p>
                                    <p className="text-base font-bold text-primary">{plan?.name || "Sem plano"}</p>
                                    <Badge variant="outline" className="text-[10px]">{sub?.status || "N/A"}</Badge>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Vencimento/Trial</p>
                                    <p className="text-sm font-medium">
                                      {sub?.trial_end ? format(new Date(sub.trial_end), "dd/MM/yyyy") : "—"}
                                    </p>
                                    {sub?.status === 'trial' && <span className="text-[10px] text-orange-600 font-bold">Em período de teste</span>}
                                  </div>
                                </div>
                              </section>

                              {/* Seção de Uso do Produto */}
                              <section className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                  <Info className="h-4 w-4" /> Uso do Produto
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="border rounded-lg p-3 text-center">
                                    <p className="text-xl font-bold">{usage?.total_properties || 0}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Imóveis</p>
                                  </div>
                                  <div className="border rounded-lg p-3 text-center">
                                    <p className="text-xl font-bold">{usage?.total_leads || 0}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Leads</p>
                                  </div>
                                  <div className="border rounded-lg p-3 text-center">
                                    <p className="text-xl font-bold">{usage?.total_users || 0}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">Membros</p>
                                  </div>
                                </div>
                                <div className="flex gap-4">
                                  <div className="flex items-center gap-2 text-xs font-medium">
                                    <Globe className={`h-4 w-4 ${site?.is_active ? 'text-primary' : 'text-muted-foreground/30'}`} />
                                    Site: {site?.custom_domain || (site?.is_active ? "Ativo" : "Inativo")}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-medium">
                                    <MessageSquare className={`h-4 w-4 ${whatsapp?.status === 'connected' ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                                    WhatsApp: {whatsapp?.status === 'connected' ? "Conectado" : "Desconectado"}
                                  </div>
                                </div>
                              </section>
                              {/* Seção de Intenções de Compra */}
                              {authUser?.payment_attempts && authUser.payment_attempts.length > 0 && (
                                <section className="space-y-4">
                                  <h3 className="text-sm font-bold flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" /> Histórico de Intenções de Compra
                                  </h3>
                                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                    {authUser.payment_attempts.map((attempt) => (
                                      <div key={attempt.id} className="text-xs border rounded p-2 bg-muted/30">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold">{attempt.plan_name} ({attempt.billing_cycle})</span>
                                          <span className="text-muted-foreground">{format(new Date(attempt.created_at), 'dd/MM/yy HH:mm')}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span>R$ {(attempt.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                          <Badge variant="outline" className="text-[9px] h-4 uppercase">
                                            {attempt.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              )}
                              
                              {/* Seção de Rastreabilidade (UTMs) */}
                              <section className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                  <MousePointer2 className="h-4 w-4" /> Rastreabilidade (UTMs)
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                  {['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map(utm => (
                                    <div key={utm} className="space-y-0.5">
                                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">{utm.replace('utm_', '')}</p>
                                      <p className="text-sm font-medium border-b pb-1">{authUser?.user_metadata?.[utm] || "—"}</p>
                                    </div>
                                  ))}
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Origem (Meta/Google)</p>
                                    <p className="text-sm font-medium border-b pb-1">{authUser?.user_metadata?.source || "—"}</p>
                                  </div>
                                </div>
                              </section>
                              
                              {/* Rodapé do Drawer com Ações Críticas */}
                              <div className="pt-6 border-t flex flex-col gap-3">
                                <p className="text-xs font-bold text-destructive uppercase">Ações de Segurança</p>
                                <div className="flex gap-2">
                                  <AlertDialog open={passwordTarget?.userId === p.user_id} onOpenChange={(open) => !open && setPasswordTarget(null)}>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setPasswordTarget({ userId: p.user_id, name: p.full_name || "" })}>
                                        <KeyRound className="h-4 w-4" /> Redefinir Senha
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Nova Senha</AlertDialogTitle>
                                        <Input type="password" placeholder="Mín. 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction disabled={newPassword.length < 6} onClick={async () => {
                                          const { data: { session } } = await supabase.auth.getSession();
                                          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
                                            method: "PATCH",
                                            headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
                                            body: JSON.stringify({ user_id: p.user_id, new_password: newPassword })
                                          });
                                          toast({ title: "Senha alterada" });
                                          setPasswordTarget(null);
                                          setNewPassword("");
                                        }}>Alterar</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm" className="gap-2">
                                        <Trash2 className="h-4 w-4" /> Excluir Conta
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                        <AlertDialogDescription>Ação irreversível para {p.full_name}.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive" onClick={async () => {
                                          const { data: { session } } = await supabase.auth.getSession();
                                          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
                                            method: "DELETE",
                                            headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
                                            body: JSON.stringify({ user_id: p.user_id })
                                          });
                                          queryClient.invalidateQueries();
                                          toast({ title: "Usuário excluído" });
                                        }}>Excluir</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                        
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                          if (org?.slug) window.open(`https://${org.slug}.portadocorretor.com`, '_blank');
                          else toast({ title: "Organização sem slug" });
                        }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
);
}
