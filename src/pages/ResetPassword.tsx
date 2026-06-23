import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { SEOHead } from "@/components/SEOHead";
import { PasswordStrengthIndicator, isPasswordStrong } from "@/components/PasswordStrengthIndicator";

/**
 * Página de redefinição de senha.
 * Acessada via link enviado por email (resetPasswordForEmail).
 * O Supabase processa o token de recovery automaticamente e cria uma sessão temporária.
 * Esta página deve ser pública (não atrás de ProtectedRoute).
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Detecta se há sessão de recovery ativa.
  // O token chega no hash da URL (#access_token=...&type=recovery). Processamos
  // explicitamente para evitar loading infinito quando o evento PASSWORD_RECOVERY
  // não dispara a tempo ou o detectSessionInUrl falha.
  useEffect(() => {
    let mounted = true;

    const finish = () => { if (mounted) setCheckingSession(false); };

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    }).data.subscription;

    const init = async () => {
      try {
        // 1) Tenta extrair tokens do hash da URL manualmente (fonte da verdade no recovery)
        const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const type = params.get("type");

        if (access_token && refresh_token && (type === "recovery" || type === null)) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error && mounted) {
            setHasRecoverySession(true);
            // limpa o hash da URL por segurança
            window.history.replaceState(null, "", window.location.pathname);
            finish();
            return;
          }
        }

        // 2) Fallback: sessão já existente
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session) setHasRecoverySession(true);
        finish();
      } catch {
        finish();
      }
    };

    init();
    // Timeout de seguranca: nunca deixa em loading infinito
    const safety = setTimeout(finish, 5000);

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ variant: "destructive", title: "Senha muito curta", description: "Mínimo de 6 caracteres." });
      return;
    }
    if (!isPasswordStrong(password)) {
      toast({ variant: "destructive", title: "Senha fraca", description: "Atenda a pelo menos 3 critérios de força." });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Senhas não conferem", description: "Confirme a mesma senha." });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast({ title: "Senha redefinida", description: "Você já pode fazer login com a nova senha." });

      // Faz logout para forçar novo login com a senha nova
      await supabase.auth.signOut();

      // Redireciona após pequeno delay para o usuário ver o feedback
      setTimeout(() => navigate("/auth", { replace: true }), 1800);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao redefinir senha",
        description: err.message || "Não foi possível atualizar sua senha. Solicite um novo link.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <SEOHead title="Redefinir Senha" description="Defina uma nova senha para sua conta." />

      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant" />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 page-enter">
          {/* Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-3">
              <HabitaeLogo variant="icon" size="lg" />
              <span className="font-display text-2xl font-bold text-foreground tracking-tight">Porta do Corretor</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8 shadow-sm space-y-6">
            {checkingSession ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Validando link de recuperação...</p>
              </div>
            ) : !hasRecoverySession ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-destructive" />
                </div>
                <h1 className="font-display text-2xl font-bold text-foreground">Link inválido ou expirado</h1>
                <p className="text-sm text-muted-foreground">
                  Este link de recuperação não é válido ou expirou. Solicite um novo na tela de login.
                </p>
                <Button onClick={() => navigate("/auth")} className="w-full">
                  Voltar para o login
                </Button>
              </div>
            ) : success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <h1 className="font-display text-2xl font-bold text-foreground">Senha redefinida!</h1>
                <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl font-bold text-foreground">Definir nova senha</h1>
                  <p className="text-sm text-muted-foreground">Escolha uma senha forte para proteger sua conta.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={password} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não conferem</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar para o login
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
