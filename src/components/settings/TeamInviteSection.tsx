import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { Copy, Loader2, Link, Trash2, Key, ShieldAlert } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRoles } from "@/hooks/useUserRole";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TeamInviteSection() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { hasRole, isLoading: rolesLoading } = useUserRoles();
  const canInvite = hasRole('admin') || hasRole('sub_admin') || hasRole('leader') || hasRole('developer');
  const isAdmin = hasRole('admin') || hasRole('developer');
  const isSubAdmin = hasRole('sub_admin');
  const { currentPlan } = useSubscription();
  const maxUsers = currentPlan?.max_users;
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("corretor");

  const availableRoles = isAdmin
    ? ["corretor", "assistente", "leader", "sub_admin"]
    : isSubAdmin
    ? ["corretor", "assistente", "leader"]
    : ["corretor", "assistente"];

  const ROLE_LABELS: Record<string, string> = {
    corretor: "Corretor",
    assistente: "Assistente (somente leitura)",
    leader: "Leader",
    sub_admin: "Sub-Dono",
  };

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["organization-invites", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("organization_invites")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });

  // Count current members for limit check
  const { data: memberCount = 0 } = useQuery({
    queryKey: ["org-member-count", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      const { count } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id);
      return count || 0;
    },
    enabled: !!profile?.organization_id,
  });

  const pendingInviteCount = invites.filter((i) => i.status === "pending").length;
  const isAtUserLimit = maxUsers != null && maxUsers > 0 && (memberCount + pendingInviteCount) >= maxUsers;

  const { data: orgInfo } = useQuery({
    queryKey: ["org-invite-info", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("invite_code, name")
        .eq("id", profile.organization_id)
        .single();
      return data || null;
    },
    enabled: !!profile?.organization_id,
  });

  const orgCode = orgInfo?.invite_code || null;
  const orgName = orgInfo?.name || null;

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id || !user) throw new Error("Sem organização");
      if (isAtUserLimit) {
        throw new Error(`Limite de ${maxUsers} usuário(s) do seu plano atingido. Faça upgrade para adicionar mais membros.`);
      }
      const email = inviteEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Informe um email válido");
      }
      const { data, error } = await supabase
        .from("organization_invites")
        .insert({
          organization_id: profile.organization_id,
          role: inviteRole as any,
          invited_by: user.id,
          email,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      const link = `${window.location.origin}/convite/${data.id}`;
      const email = inviteEmail.trim().toLowerCase();
      setInviteEmail("");
      setInviteName("");
      queryClient.invalidateQueries({ queryKey: ["organization-invites"] });

      // Always copy link as fallback (even if email fails)
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* clipboard may be unavailable in insecure contexts */
      }

      // Send email (non-blocking — failure doesn't undo the invite)
      try {
        const { data: emailRes, error } = await supabase.functions.invoke("send-invite-email", {
          body: {
            to: email,
            type: "team",
            invite_link: link,
            org_name: orgName || undefined,
            org_code: orgCode || undefined,
            inviter_name: profile?.full_name || undefined,
          },
        });
        if (error) throw error;
        if (emailRes?.error) throw new Error(emailRes.error);
        toast.success(`Convite enviado para ${email}`, {
          description: "Link também foi copiado para a área de transferência.",
        });
      } catch (e: any) {
        console.error("[TeamInviteSection] email send failed:", e);
        toast.warning("Convite criado, mas o email falhou", {
          description: "O link foi copiado — envie manualmente ao convidado.",
          duration: 7000,
        });
      }
    },
    onError: (err: Error) => {
      toastError("Erro ao criar convite", err, { module: "TeamInviteSection" });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organization_invites")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite removido");
      queryClient.invalidateQueries({ queryKey: ["organization-invites"] });
    },
  });

  const getInviteLink = (id: string) => `${window.location.origin}/convite/${id}`;

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(getInviteLink(id));
    toast.success("Link copiado!");
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendente";
      case "accepted": return "Aceito";
      case "expired": return "Expirado";
      default: return status;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pending": return "outline";
      case "accepted": return "default";
      case "expired": return "destructive";
      default: return "secondary";
    }
  };

  const pendingInvites = invites.filter((i) => i.status === "pending");
  const otherInvites = invites.filter((i) => i.status !== "pending");

  if (rolesLoading) return null;

  if (!canInvite) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
          <p>Somente líderes podem enviar convites para a equipe.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Convidar Membro
          </CardTitle>
          <CardDescription>
            Gere um link único para um corretor ou assistente se cadastrar na sua imobiliária.
            O assistente terá acesso somente leitura aos mesmos dados do corretor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orgCode && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Código da imobiliária</p>
                <p className="font-mono font-bold text-lg tracking-widest">{orgCode}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => {
                  navigator.clipboard.writeText(orgCode);
                  toast.success("Código copiado!");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nome</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome do membro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="membro@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role] || role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isAtUserLimit && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Limite de {maxUsers} usuário(s) do plano atingido. Faça upgrade para convidar mais membros.</span>
            </div>
          )}

          {maxUsers != null && maxUsers > 0 && !isAtUserLimit && (
            <p className="text-xs text-muted-foreground">
              {memberCount + pendingInviteCount} de {maxUsers} vaga(s) utilizadas
            </p>
          )}

          <Button onClick={() => createInvite.mutate()} disabled={createInvite.isPending || !inviteEmail.trim() || isAtUserLimit}>
            {createInvite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Gerar Link de Convite
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convites Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{invite.email || "Sem email"}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role === 'assistente' ? 'Assistente' : 'Corretor'} · Expira em {format(new Date(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                   </p>
                </div>
                <Badge variant={statusVariant(invite.status)}>{statusLabel(invite.status)}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => copyLink(invite.id)} title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteInvite.mutate(invite.id)} title="Remover convite">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {otherInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Convites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {otherInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{invite.email || "Sem email"}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role === 'assistente' ? 'Assistente' : 'Corretor'} · {invite.accepted_at
                      ? `Aceito em ${format(new Date(invite.accepted_at), "dd/MM/yyyy", { locale: ptBR })}`
                      : `Criado em ${format(new Date(invite.created_at), "dd/MM/yyyy", { locale: ptBR })}`
                    }
                  </p>
                </div>
                <Badge variant={statusVariant(invite.status)}>{statusLabel(invite.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && invites.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum convite enviado ainda
        </p>
      )}
    </div>
  );
}
