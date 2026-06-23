import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PillBadge } from "@/components/ui/pill-badge";
import { Building2, User, Camera, Loader2, ShieldCheck, Mail, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { useImageUpload } from "@/hooks/useImageUpload";
import { VerificationSection } from "@/components/settings/VerificationSection";

const BRAZILIAN_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export function SettingsProfileTab() {
  const { user, profile, refreshProfile, organizationType } = useAuth();
  const { uploadImage, isUploading: isUploadingAvatar } = useImageUpload();
  const { currentPlan } = useSubscription();
  const isCorrespondentePlan = currentPlan?.slug === "correspondente";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [creci, setCreci] = useState("");
  const [creciState, setCreciState] = useState("SP");
  const [savingProfile, setSavingProfile] = useState(false);
  const [verifyingCreci, setVerifyingCreci] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setCreci(profile.creci || "");
      setEmail(user?.email || "");
    }
  }, [profile, user?.email]);

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);

    const emailChanged = email.trim().toLowerCase() !== (user?.email || "").toLowerCase();
    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) { toastError("Erro ao alterar e-mail", emailError, { module: "Settings" }); setSavingProfile(false); return; }
      toast.info("Um link de confirmação foi enviado para o novo e-mail.");
    }

    const creciChanged = creci.trim() !== (profile.creci || "").trim();
    if (creciChanged && creci.trim()) {
      setVerifyingCreci(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada");
        const response = await supabase.functions.invoke("verify-creci", {
          body: { action: "verify-creci", creci_number: creci.trim(), user_name: fullName, creci_state: creciState },
        });
        if (response.error) throw response.error;
        const result = response.data as { verified: boolean; message: string };
        if (!result.verified) { toastError("CRECI não verificado: " + result.message, undefined, { module: "Settings" }); setVerifyingCreci(false); setSavingProfile(false); return; }
        toast.success("CRECI verificado com sucesso!");
      } catch (err: any) { toastError("Erro ao verificar CRECI", err, { module: "Settings" }); setVerifyingCreci(false); setSavingProfile(false); return; }
      setVerifyingCreci(false);
    }

    const updateData: Record<string, any> = { full_name: fullName, phone, creci: creci.trim() };
    if (creciChanged && !creci.trim()) { updateData.creci_verified = false; updateData.creci_verified_at = null; updateData.creci_verified_name = null; }

    const { error } = await supabase.from("profiles").update(updateData as any).eq("id", profile.id);
    setSavingProfile(false);
    if (error) toastError("Erro ao salvar perfil", undefined, { module: "Settings" });
    else { toast.success("Perfil atualizado com sucesso"); refreshProfile(); }
  };

  const handleSendPasswordReset = async () => {
    const userEmail = user?.email;
    if (!userEmail) return toastError("E-mail não encontrado", undefined, { module: "Settings" });
    setSendingResetLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, { redirectTo: window.location.origin + "/configuracoes" });
    setSendingResetLink(false);
    if (error) toastError("Erro ao enviar link de redefinição", error, { module: "Settings" });
    else { setResetLinkSent(true); toast.success("Link de redefinição enviado para " + userEmail); }
  };

  // Read company name for display
  const [companyName, setCompanyName] = useState("");
  useEffect(() => {
    if (!profile?.organization_id) return;
    supabase.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle().then(({ data }) => {
      if (data?.name) setCompanyName(data.name);
    });
  }, [profile?.organization_id]);

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
          <CardDescription>Atualize seus dados de perfil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={fullName} />}
                <AvatarFallback className="text-lg">{fullName ? getInitials(fullName) : "U"}</AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-5 w-5 text-background" />
                <input type="file" accept="image/*" className="hidden" disabled={isUploadingAvatar}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !profile) return;
                    const result = await uploadImage(file, 'avatars');
                    if (result) {
                      await supabase.from("profiles").update({ avatar_url: result.url }).eq("id", profile.id);
                      refreshProfile();
                      toast.success("Foto atualizada!");
                    }
                  }} />
              </label>
            </div>
            <div>
              <p className="font-medium">{fullName || "Usuário"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {companyName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />{companyName}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {email.trim().toLowerCase() !== (user?.email || "").toLowerCase() && (
                <p className="text-xs text-muted-foreground">Um link de confirmação será enviado ao novo e-mail.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            {!isCorrespondentePlan && (
              <div className="space-y-2">
                <Label htmlFor="creci">CRECI</Label>
                <div className="flex gap-2">
                  <Select value={creciState} onValueChange={setCreciState}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Input id="creci" value={creci} onChange={(e) => setCreci(e.target.value)} placeholder="000000-F" className="flex-1" />
                </div>
                {creci.trim() !== (profile?.creci || "").trim() && creci.trim() && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />O CRECI será verificado automaticamente ao salvar.
                  </p>
                )}
              </div>
            )}
          </div>

          {organizationType && (
            <div className="space-y-2">
              <Label>Tipo de conta</Label>
              <div>
                <PillBadge variant={organizationType === 'imobiliaria' ? 'warning' : 'muted'}
                  icon={organizationType === 'imobiliaria' ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}>
                  {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
                </PillBadge>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile || verifyingCreci}>
              {(savingProfile || verifyingCreci) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {verifyingCreci ? "Verificando CRECI..." : "Salvar alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Para sua segurança, enviaremos um link de redefinição ao seu e-mail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ao clicar no botão abaixo, um e-mail com um link seguro será enviado para <strong>{user?.email}</strong>.
          </p>
          {resetLinkSent && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span>Link enviado! Verifique sua caixa de entrada e spam.</span>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleSendPasswordReset} disabled={sendingResetLink}>
              {sendingResetLink && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Mail className="h-4 w-4 mr-2" />Enviar link de redefinição
            </Button>
          </div>
        </CardContent>
      </Card>

      <VerificationSection />

      <Separator />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Sair da conta</CardTitle>
          <CardDescription>Encerre sua sessão neste dispositivo</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}>
            <LogOut className="h-4 w-4 mr-2" />Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
