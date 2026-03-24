import React, { useState, useEffect, useRef } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { trackLoginSuccess } from "@/components/ClarityProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, ArrowLeft, Construction, Building2, User, Eye, EyeOff, Check, Gift, Crown, Zap, Star, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { supabase } from "@/integrations/supabase/client";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { cn } from "@/lib/utils";
import { PasswordStrengthIndicator, isPasswordStrong } from "@/components/PasswordStrengthIndicator";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface SignupPlan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  trial_days: number | null;
  features: Record<string, any> | null;
  description: string | null;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  gratuito: Gift,
  starter: Zap,
  essencial: Star,
  profissional: Crown,
};

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatDocument = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const validateDocument = (doc: string) => {
  const digits = doc.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
};

const signupSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").refine(isPasswordStrong, "Senha muito fraca — atenda pelo menos 3 critérios"),
  company_name: z.string().min(2, "Nome da empresa obrigatório"),
  phone: z.string().min(14, "Telefone obrigatório (com DDD)"),
  document: z.string().refine(validateDocument, "CPF (11 dígitos) ou CNPJ (14 dígitos) inválido"),
  account_type: z.enum(["imobiliaria", "corretor_individual"]),
});

const SIGNUP_OTP_LENGTH = 8;

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

  // Email verification state
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Signup state
  const [signupForm, setSignupForm] = useState({
    full_name: "",
    email: "",
    password: "",
    company_name: "",
    phone: "",
    document: "",
    account_type: "imobiliaria" as "imobiliaria" | "corretor_individual",
    selected_plan: "starter",
  });

  // Fetch available plans for signup
  const { data: signupPlans = [] } = useQuery({
    queryKey: ["signup-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, slug, price_monthly, trial_days, features, description")
        .eq("is_active", true)
        .neq("plan_type", "addon")
        .order("display_order")
        .limit(5);
      if (error) throw error;
      return (data as SignupPlan[]).filter(p => ['gratuito', 'starter', 'essencial', 'profissional'].includes(p.slug));
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inline duplicate checks using server-side RPC
  const checkDuplicate = async (field: "email" | "phone" | "document", value: string) => {
    if (!value) return;
    setErrors((prev) => ({ ...prev, [field]: "" }));

    try {
      const { data } = await supabase.rpc("check_signup_duplicates", {
        p_email: field === "email" ? value : "",
        p_phone: field === "phone" ? value : "",
        p_document: field === "document" ? value.replace(/\D/g, "") : "",
      });

      if (data && typeof data === "object") {
        const result = data as Record<string, string>;
        if (result[field]) {
          setErrors((prev) => ({ ...prev, [field]: result[field] }));
        }
      }
    } catch {
      // Silent fail
    }
  };

  // Resend cooldown cleanup
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startResendCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (user && !loading && !showEmailVerification) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate, showEmailVerification]);

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

  const openEmailVerificationStep = (email: string, password: string) => {
    setPendingEmail(email.trim().toLowerCase());
    setPendingPassword(password);
    setOtpCode("");
    setShowEmailVerification(true);
    startResendCooldown();
  };

  const tryResumePendingSignup = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({ type: "signup", email: normalizedEmail });

    if (error) {
      return false;
    }

    openEmailVerificationStep(normalizedEmail, password);
    toast({
      title: "Cadastro pendente encontrado",
      description: "Enviamos um novo código de confirmação para seu e-mail.",
    });

    return true;
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

    // Pre-check all duplicates before attempting signup
    try {
      const { data: dupes } = await supabase.rpc("check_signup_duplicates", {
        p_email: signupForm.email,
        p_phone: signupForm.phone,
        p_document: signupForm.document.replace(/\D/g, ""),
      });

      if (dupes && typeof dupes === "object") {
        const dupeResult = dupes as Record<string, string>;
        const hasIssues = Object.keys(dupeResult).length > 0;

        if (hasIssues) {
          const resumedPendingSignup =
            !!dupeResult.email && (await tryResumePendingSignup(signupForm.email, signupForm.password));

          if (resumedPendingSignup) {
            setIsLoading(false);
            return;
          }

          setErrors(dupeResult);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // If RPC fails, continue with signup (server will catch duplicates)
    }

    try {
      const { error } = await signUp({
        email: signupForm.email,
        password: signupForm.password,
        name: signupForm.full_name,
        phone: signupForm.phone,
        document: signupForm.document.replace(/\D/g, ""),
        accountType: signupForm.account_type,
        companyName: signupForm.company_name,
        selectedPlan: signupForm.selected_plan,
      });

      if (error) {
        if (error.message.includes("already been registered")) {
          const resumedPendingSignup = await tryResumePendingSignup(signupForm.email, signupForm.password);

          if (resumedPendingSignup) {
            setIsLoading(false);
            return;
          }

          setErrors((prev) => ({ ...prev, email: "Este email já está cadastrado e confirmado. Faça login." }));
        } else if (error.message.includes("Telefone ou documento")) {
          const msg = error.message;
          if (msg.includes("telefone")) setErrors((prev) => ({ ...prev, phone: "Este telefone já está cadastrado" }));
          if (msg.includes("documento")) setErrors((prev) => ({ ...prev, document: "Este CPF/CNPJ já está cadastrado" }));
        } else {
          toast({ variant: "destructive", title: "Erro ao cadastrar", description: error.message });
        }
        setIsLoading(false);
        return;
      }

      openEmailVerificationStep(signupForm.email, signupForm.password);
      setIsLoading(false);

    } catch (err: any) {
      setIsLoading(false);
      toast({ variant: "destructive", title: "Erro ao cadastrar", description: err.message || "Erro inesperado." });
    }
  };

  const handleVerifyOtp = async () => {
    const sanitizedOtp = otpCode.replace(/\D/g, "");
    if (sanitizedOtp.length !== 6) return;

    if (!pendingEmail) {
      toast({
        variant: "destructive",
        title: "E-mail não encontrado",
        description: "Volte ao cadastro e solicite um novo código.",
      });
      return;
    }

    setVerifyingOtp(true);

    try {
      const verificationTypes = ["signup", "email"] as const;
      let lastError: Error | null = null;

      for (const type of verificationTypes) {
        const { error } = await supabase.auth.verifyOtp({
          email: pendingEmail.trim().toLowerCase(),
          token: sanitizedOtp,
          type,
        });

        if (!error) {
          toast({ title: "Bem-vindo!", description: "Email verificado com sucesso!" });
          navigate("/dashboard", { replace: true });
          return;
        }

        lastError = error;
        const shouldTryFallback =
          type === "signup" &&
          (((error as { status?: number }).status ?? 0) === 403 || /otp_expired|expired|invalid/i.test(error.message || ""));

        if (!shouldTryFallback) break;
      }

      const expiredOrInvalid = /otp_expired|expired|invalid/i.test(lastError?.message || "");
      toast({
        variant: "destructive",
        title: expiredOrInvalid ? "Código expirado ou inválido" : "Falha na verificação",
        description: expiredOrInvalid
          ? "Reenvie o código e use apenas o último email recebido."
          : "Verifique o código e tente novamente.",
      });
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro ao verificar código." });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail.trim().toLowerCase() });
      if (error) throw error;
      setOtpCode("");
      startResendCooldown();
      toast({ title: "Código reenviado", description: "Use o código mais recente enviado para seu e-mail." });
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível reenviar o código." });
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

          {showEmailVerification ? (
            /* ===== EMAIL VERIFICATION ===== */
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">Verifique seu email</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Enviamos um código de 6 dígitos para <span className="font-medium text-foreground">{pendingEmail}</span>
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otpCode}
                  onChange={setOtpCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyOtp}
                size="lg"
                variant="gold"
                className="w-full h-14 text-base"
                disabled={otpCode.length !== 6 || verifyingOtp}
              >
                {verifyingOtp ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verificar e entrar"}
              </Button>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : "Reenviar código"}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => { setShowEmailVerification(false); setOtpCode(""); }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao cadastro
                  </button>
                </div>
              </div>
            </div>
          ) : showForgotPassword ? (
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

              {/* Plan selection */}
              <div className="space-y-2">
                <Label className="editorial-label-muted">Escolha seu plano</Label>
                <div className="grid grid-cols-2 gap-2">
                  {signupPlans.map((plan) => {
                    const PlanIcon = PLAN_ICONS[plan.slug] || Star;
                    const isSelected = signupForm.selected_plan === plan.slug;
                    const trialDays = plan.trial_days || 0;
                    return (
                      <button
                        key={plan.slug}
                        type="button"
                        onClick={() => setSignupForm({ ...signupForm, selected_plan: plan.slug })}
                        className={cn(
                          "relative flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-accent/50"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <PlanIcon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{plan.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {plan.price_monthly === 0
                            ? "Grátis"
                            : `R$ ${(plan.price_monthly / 100).toFixed(2)}/mês`}
                        </span>
                        {trialDays > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5">
                            {trialDays} dias grátis
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Selected plan benefit summary */}
                {(() => {
                  const sel = signupPlans.find(p => p.slug === signupForm.selected_plan);
                  if (!sel) return null;
                  const trialDays = sel.trial_days || 0;
                  return (
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-xs text-muted-foreground space-y-1">
                      {trialDays > 0 && (
                        <p className="flex items-center gap-1.5 text-primary font-medium">
                          <Gift className="h-3.5 w-3.5" />
                          {trialDays} dias de teste grátis incluídos
                        </p>
                      )}
                      {sel.slug === 'gratuito' && (
                        <p>Acesso limitado por 15 dias. Upgrade a qualquer momento.</p>
                      )}
                      {sel.slug !== 'gratuito' && sel.price_monthly > 0 && (
                        <p>Cobrança de R$ {(sel.price_monthly / 100).toFixed(2)}/mês após o período gratuito.</p>
                      )}
                    </div>
                  );
                })()}
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
                  <Label htmlFor="signup-phone" className="editorial-label-muted">Telefone *</Label>
                <Input
                    id="signup-phone" placeholder="(11) 99999-9999"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: formatPhone(e.target.value) })}
                    onBlur={() => checkDuplicate("phone", signupForm.phone)}
                    className="h-11 bg-muted/40 border-border/50 text-sm"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-document" className="editorial-label-muted">CPF ou CNPJ *</Label>
                <Input
                  id="signup-document"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={signupForm.document}
                  onChange={(e) => setSignupForm({ ...signupForm, document: formatDocument(e.target.value) })}
                  onBlur={() => checkDuplicate("document", signupForm.document)}
                  className="h-11 bg-muted/40 border-border/50 text-sm"
                />
                {errors.document && <p className="text-xs text-destructive">{errors.document}</p>}
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
                  onBlur={() => checkDuplicate("email", signupForm.email)}
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
                <PasswordStrengthIndicator password={signupForm.password} />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" size="lg" variant="gold" className="w-full h-14 text-base group glow-primary-hover" disabled={isLoading || isMaintenanceMode}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    {signupForm.selected_plan === 'gratuito' ? 'Criar Conta Gratuita' : `Começar com ${signupPlans.find(p => p.slug === signupForm.selected_plan)?.name || 'Starter'}`}
                    <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1.5" />
                  </>
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
