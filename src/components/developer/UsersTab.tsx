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

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: any;
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>Gerencie cargos e contas de todos os usuários</CardDescription>
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / ID / Email</TableHead>
                <TableHead>Cargos</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const userRoles = allRoles.filter((r) => r.user_id === p.user_id);
                const email = getEmail(p.user_id);
                const isUpdating = updatingRoles === p.user_id;
                return (
                  <TableRow key={p.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.full_name}</p>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors cursor-pointer"
                          title="Copiar ID"
                          onClick={() => {
                            navigator.clipboard.writeText(p.user_id);
                            toast({ title: "ID copiado!" });
                          }}
                        >
                          {p.user_id.slice(0, 8)}…
                        </button>
                        <p className="text-xs text-muted-foreground">{email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {userRoles.map((r) => (
                          <Badge
                            key={r.id}
                            variant={roleBadgeVariant(r.role)}
                            className="text-[10px] gap-1 cursor-pointer hover:opacity-80 pr-1"
                            onClick={() => !isUpdating && toggleRole(p.user_id, r.role, userRoles)}
                          >
                            {roleLabel[r.role] || r.role}
                            <X className="h-2.5 w-2.5" />
                          </Badge>
                        ))}
                        {userRoles.length === 0 && <Badge variant="outline" className="text-[10px]">corretor (padrão)</Badge>}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isUpdating}>
                              {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="start">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Cargos</p>
                            {ALL_ROLES.map((role) => {
                              const hasRole = userRoles.some(r => r.role === role);
                              return (
                                <label
                                  key={role}
                                  className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                                >
                                  <Checkbox
                                    checked={hasRole}
                                    onCheckedChange={() => toggleRole(p.user_id, role, userRoles)}
                                    disabled={isUpdating}
                                  />
                                  <span>{roleLabel[role]}</span>
                                </label>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <AlertDialog open={passwordTarget?.userId === p.user_id} onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(""); } }}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPasswordTarget({ userId: p.user_id, name: p.full_name || "" })}>
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
                              <AlertDialogDescription>
                                Definir nova senha para <strong>{p.full_name}</strong> ({email})
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                              type="password"
                              placeholder="Nova senha (mín. 6 caracteres)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={newPassword.length < 6}
                                onClick={async () => {
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const res = await fetch(
                                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
                                      { method: "PATCH", headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: p.user_id, new_password: newPassword }) }
                                    );
                                    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro"); }
                                    toast({ title: `Senha de ${p.full_name} redefinida com sucesso` });
                                  } catch (e) {
                                    toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
                                  } finally {
                                    setPasswordTarget(null);
                                    setNewPassword("");
                                  }
                                }}
                              >
                                Redefinir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Excluir usuário
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Excluir <strong>{p.full_name}</strong> ({email})? Esta ação é irreversível.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const res = await fetch(
                                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
                                      { method: "DELETE", headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: p.user_id }) }
                                    );
                                    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao excluir"); }
                                    queryClient.invalidateQueries({ queryKey: ["all-profiles-dev"] });
                                    queryClient.invalidateQueries({ queryKey: ["admin-users-emails"] });
                                    queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
                                    toast({ title: `${p.full_name} excluído com sucesso` });
                                  } catch (e) {
                                    toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
                                  }
                                }}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
  );
}
