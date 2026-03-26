import { useState, useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PillBadge } from "@/components/ui/pill-badge";
import { Building2, User, Crown, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { TeamInviteSection } from "@/components/settings/TeamInviteSection";

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export function SettingsTeamTab() {
  const { user, profile, organizationType } = useAuth();
  const { isAdmin, isDeveloper } = useUserRoles();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    if (!profile?.organization_id) return;
    const loadTeam = async () => {
      setLoadingTeam(true);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").eq("organization_id", profile.organization_id!);
      if (profiles) {
        const userIds = profiles.map(p => p.user_id);
        const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
        const { data: emails } = await supabase.rpc("get_org_member_emails", { org_id: profile.organization_id! });
        const members: TeamMember[] = profiles.map(p => {
          const userRole = roles?.find(r => r.user_id === p.user_id);
          const memberEmail = (emails as { user_id: string; email: string }[] | null)?.find(e => e.user_id === p.user_id)?.email || "";
          return { user_id: p.user_id, full_name: p.full_name, email: memberEmail, role: userRole?.role || "corretor" };
        });
        setTeamMembers(members);
      }
      setLoadingTeam(false);
    };
    loadTeam();
  }, [profile?.organization_id]);

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Dono";
      case "sub_admin": return "Sub-Dono";
      case "developer": return "Developer";
      case "leader": return "Leader";
      case "assistente": return "Assistente";
      default: return "Corretor";
    }
  };

  const ASSIGNABLE_ROLES = [
    { value: "corretor", label: "Corretor" },
    { value: "assistente", label: "Assistente" },
    { value: "sub_admin", label: "Sub-Dono" },
    ...(isDeveloper ? [{ value: "admin", label: "Dono" }] : []),
  ];

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", memberId);
    if (deleteError) { toastError("Erro ao alterar cargo", undefined, { module: "Settings" }); return; }
    const { error: insertError } = await supabase.from("user_roles").insert({ user_id: memberId, role: newRole as Database["public"]["Enums"]["app_role"] });
    if (insertError) { toastError("Erro ao alterar cargo", undefined, { module: "Settings" }); return; }
    setTeamMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: newRole } : m));
    const member = teamMembers.find(m => m.user_id === memberId);
    toast.success(`Cargo de ${member?.full_name} alterado para ${roleLabel(newRole)}`);
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Membros da Equipe</CardTitle>
              <CardDescription>Usuários da sua organização</CardDescription>
            </div>
            {organizationType && (
              <PillBadge size="sm" variant={organizationType === 'imobiliaria' ? 'warning' : 'muted'}
                icon={organizationType === 'imobiliaria' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}>
                {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
              </PillBadge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingTeam ? (
            <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : teamMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum membro encontrado</p>
          ) : (
            <div className="space-y-3">
              {teamMembers.map(member => {
                const isCurrentUser = member.user_id === user?.id;
                const isSystemRole = member.role === "developer" || member.role === "leader";
                const isMemberAdmin = member.role === "admin";
                const canChangeRole = (isAdmin || isDeveloper) && !isCurrentUser && !isSystemRole && !(isMemberAdmin && !isDeveloper);

                return (
                  <div key={member.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0"><AvatarFallback>{getInitials(member.full_name)}</AvatarFallback></Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}{isCurrentUser && " (você)"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-13 sm:pl-0 shrink-0">
                      {canChangeRole ? (
                        <Select value={member.role} onValueChange={val => handleChangeRole(member.user_id, val)}>
                          <SelectTrigger className="w-full sm:w-[140px] min-h-[40px] sm:min-h-[32px] text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map(r => (
                              <SelectItem key={r.value} value={r.value}><span>{r.label}</span></SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <PillBadge size="sm" variant={isMemberAdmin ? 'default' : member.role === 'sub_admin' ? 'warning' : 'muted'}
                          icon={isMemberAdmin ? <Crown className="h-3 w-3" /> : member.role === 'sub_admin' ? <Shield className="h-3 w-3" /> : undefined}>
                          {roleLabel(member.role)}
                        </PillBadge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <TeamInviteSection />
    </div>
  );
}
