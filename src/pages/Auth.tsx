import React, { useState, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { trackLoginSuccess } from "@/components/ClarityProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft, Construction, Building2, User, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { supabase } from "@/integrations/supabase/client";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { z } from "zod";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const signupSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  company_name: z.string().min(2, "Nome da empresa obrigatório"),
  phone: z.string().optional(),
  account_type: z.enum(["imobiliaria", "corretor_individual"]),
});

const Auth = React.forwardRef<HTMLDivElement, object>(function Auth(_props, _ref) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const { isMaintenanceMode, maintenanceMessage } = useMaintenanceMode();

  const initialTab = searchParams.get("tab") === "cadastro" ? "signup" : "login";
  const [activeTab, setActiveTab] = useState<"login" | "signup">(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  // Signup state
  const [signupForm, setSignupForm] = useState({
    full_name: "",
    email: "",
    password: "",
    company_name: "",
    phone: "",
    account_type: "imobiliaria" as "imobiliaria" | "corretor_individual",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && !loading) {
      // If profile exists and onboarding not completed, redirect to onboarding
      // Otherwise go to dashboard (AuthContext handles profile fetch)
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaintenanceMode) return;
    setErrors({});

    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message,
      });
    } else {
      trackLoginSuccess();
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMaintenanceMode) return;
    setErrors({});

    const result = signupSchema.safeParse(signupForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signUp({
      email: signupForm.email,
      password: signupForm.password,
      name: signupForm.full_name,
      phone: signupForm.phone || "",
      accountType: signupForm.account_type,
      companyName: signupForm.company_name,
    });
    setIsLoading(false);

    if (error) {
      const msg = error.message.includes("already been registered")
        ? "Este email já está cadastrado. Faça login."
        : error.message;
      toast({ variant: "destructive", title: "Erro ao cadastrar", description: msg });
    } else {
      toast({ title: "Conta criada!", description: "Bem-vindo ao Porta do Corretor." });
      // Auth state change will redirect automatically
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.functions.invoke("send-reset-email", {
        body: { email: resetEmail.trim(), redirect_to: window.location.origin + "/auth" },
      });
      if (error) throw error;
      toast({ title: "Link enviado", description: "Verifique sua caixa de entrada para redefinir sua senha." });
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message || "Não foi possível enviar o email." });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background" data-clarity-mask="true">
      <SEOHead
        title={activeTab === "login" ? "Login" : "Criar Conta"}
        description="Acesse o Porta do Corretor — plataforma completa para corretores e imobiliárias."
      />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant" />
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-[25%] -right-[15%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(0 72% 50%), transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute top-[40%] -left-[20%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, hsl(31 100% 48%), transparent 70%)", filter: "blur(60px)" }}
        />
      </div>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-md space-y-8 page-enter">
          {/* Logo */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-3">
              <HabitaeLogo variant="icon" size="lg" />
              <span className="font-display text-2xl font-bold text-foreground tracking-tight">Porta do Corretor</span>
            </div>
            <span className="editorial-label-accent flex items-center gap-2">
              <span className="color-dot-accent" />
              Plataforma de Performance
            </span>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setActiveTab("login"); setErrors({}); }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                activeTab === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Entrar
            </button>
            <button
              onClick={() => { setActiveTab("signup"); setErrors({}); }}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                activeTab === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Criar Conta
            </button>
          </div>

          {/* Maintenance banner */}
          {isMaintenanceMode && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Construction className="h-5 w-5" />
                <span className="font-semibold text-sm">Sistema em Manutenção</span>
              </div>
              <p className="text-sm text-muted-foreground">{maintenanceMessage}</p>
            </div>
          )}

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar ao login
                </button>
                <h2 className="font-display text-xl font-bold text-foreground">Recuperar senha</h2>
                <p className="text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para redefinir.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="editorial-label-muted">Email</Label>
                <Input
                  id="reset-email" type="email" placeholder="seu@email.com" value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-12 bg-muted/40 border-border/50 text-base"
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" variant="gold" className="w-full h-14 text-base" disabled={sendingReset || !resetEmail.trim()}>
                {sendingReset ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar link de recuperação"}
              </Button>
            </form>
          ) : activeTab === "login" ? (
            /* ===== LOGIN ===== */
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="text-center mb-2">
                <h1 className="font-display text-3xl font-extrabold text-foreground">
                  Bem-vindo <span className="text-gradient-vibrant">de volta.</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Entre para gerenciar leads e escalar resultados.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="editorial-label-muted">Email</Label>
                <Input
                  id="login-email" type="email" placeholder="seu@email.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="h-12 bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-accent/40 transition-all duration-300"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="editorial-label-muted">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="h-12 bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-accent/40 transition-all duration-300 pr-12"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => { setShowForgotPassword(true); setResetEmail(loginForm.email); }} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                  Esqueci minha senha
                </button>
              </div>

              <Button type="submit" size="lg" variant="gold" className="w-full h-14 text-base group glow-primary-hover" disabled={isLoading || isMaintenanceMode}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isMaintenanceMode ? "Login indisponível" : (
                  <>Entrar na plataforma <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1.5" /></>
                )}
              </Button>
            </form>
          ) : (
            /* ===== SIGNUP ===== */
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="text-center mb-2">
                <h1 className="font-display text-3xl font-extrabold text-foreground">
                  Comece <span className="text-gradient-vibrant">agora.</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Crie sua conta e teste grátis por até 15 dias.</p>
              </div>

              {/* Account type */}
              <div className="space-y-2">
                <Label className="editorial-label-muted">Tipo de conta</Label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "imobiliaria", label: "Imobiliária", icon: Building2 },
                    { value: "corretor_individual", label: "Corretor", icon: User },
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSignupForm({ ...signupForm, account_type: value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                        signupForm.account_type === value
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name" className="editorial-label-muted">Nome completo *</Label>
                  <Input
                    id="signup-name" placeholder="Seu nome"
                    value={signupForm.full_name}
                    onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
                    className="h-11 bg-muted/40 border-border/50 text-sm"
                  />
                  {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-phone" className="editorial-label-muted">Telefone</Label>
                  <Input
                    id="signup-phone" placeholder="(11) 99999-9999"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                    className="h-11 bg-muted/40 border-border/50 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-company" className="editorial-label-muted">
                  {signupForm.account_type === "imobiliaria" ? "Nome da Imobiliária *" : "Nome Profissional *"}
                </Label>
                <Input
                  id="signup-company"
                  placeholder={signupForm.account_type === "imobiliaria" ? "Imobiliária Exemplo" : "João Silva Imóveis"}
                  value={signupForm.company_name}
                  onChange={(e) => setSignupForm({ ...signupForm, company_name: e.target.value })}
                  className="h-11 bg-muted/40 border-border/50 text-sm"
                />
                {errors.company_name && <p className="text-xs text-destructive">{errors.company_name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="editorial-label-muted">Email *</Label>
                <Input
                  id="signup-email" type="email" placeholder="seu@email.com"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  className="h-11 bg-muted/40 border-border/50 text-sm"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password" className="editorial-label-muted">Senha *</Label>
                <div className="relative">
                  <Input
                    id="signup-password" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    className="h-11 bg-muted/40 border-border/50 text-sm pr-12"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" size="lg" variant="gold" className="w-full h-14 text-base group glow-primary-hover" disabled={isLoading || isMaintenanceMode}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>Criar Conta Gratuita <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1.5" /></>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Sem cartão · Sem compromisso · Cancele quando quiser
              </p>
            </form>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 tracking-widest uppercase">
            Porta do Corretor — Performance e Conversão
          </p>
        </div>
      </main>
    </div>
  );
});
Auth.displayName = "Auth";

export default Auth;
