import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2, User, ArrowRight, ArrowLeft,
  CheckCircle2, Sparkles, Loader2, Phone
} from "lucide-react";

const ACCOUNT_TYPES = [
  { value: "corretor_individual", label: "Corretor autônomo", icon: User, desc: "Trabalho sozinho(a)" },
  { value: "imobiliaria", label: "Imobiliária", icon: Building2, desc: "Tenho equipe / empresa" },
] as const;

type AccountType = typeof ACCOUNT_TYPES[number]["value"];

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
  trial_days: number | null;
  description: string | null;
}

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { profile, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form state
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [planSlug, setPlanSlug] = useState<string>("gratuito");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planOnlyMode, setPlanOnlyMode] = useState<boolean | null>(null);
  const [phoneTaken, setPhoneTaken] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);

  // Debounced check: pergunta ao backend se o telefone já está em uso por outra conta.
  useEffect(() => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) {
      setPhoneTaken(false);
      setPhoneChecking(false);
      return;
    }
    setPhoneChecking(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_phone_available", { p_phone: clean });
      if (!error) setPhoneTaken(data === false);
      setPhoneChecking(false);
    }, 450);
    return () => clearTimeout(t);
  }, [phone]);

  // Detecta se usuário (geralmente OAuth/Google legacy) já completou onboarding
  // mas não possui subscription — nesse caso reabrimos o wizard direto no passo de plano.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.user_id) return;
      if (!profile.onboarding_completed) {
        if (!cancelled) setPlanOnlyMode(false);
        return;
      }
      if (!profile.organization_id) {
        if (!cancelled) setPlanOnlyMode(false);
        return;
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .in("status", ["active", "trial", "pending"])
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (sub) {
        // Já tem plano → vai para o dashboard.
        navigate("/dashboard", { replace: true });
      } else {
        // Onboarding completo mas sem subscription (legacy Google) → só pede plano.
        setPlanOnlyMode(true);
        // Pré-preenche para a chamada do RPC
        setAccountType("imobiliaria");
        setCompanyName(profile.full_name || "");
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.user_id, profile?.onboarding_completed, profile?.organization_id, profile?.full_name, navigate]);

  // Pré-preenche telefone do profile se existir. Não pré-preenche companyName
  // para imobiliária (full_name do Google é nome pessoal, não da empresa).
  useEffect(() => {
    if (profile?.phone && !phone) setPhone(profile.phone);
    if (profile?.full_name && !companyName && accountType === "corretor_individual") {
      setCompanyName(profile.full_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id, accountType]);

  // Buscar planos visíveis no onboarding (exclui addons e personalizado)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, slug, name, price_monthly, trial_days, description, display_order")
        .eq("is_active", true)
        .not("slug", "like", "addon-%")
        .neq("slug", "personalizado")
        .neq("slug", "enterprise")
        .order("display_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[Onboarding] plans fetch error:", error);
      } else {
        setPlans((data ?? []) as PlanRow[]);
      }
      setPlansLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const finish = async () => {
    if (!profile?.user_id) {
      toast.error("Sessão inválida. Faça login novamente.");
      navigate("/auth", { replace: true });
      return;
    }
    if (!accountType) {
      toast.error("Selecione o tipo de conta.");
      setStep(1);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Telefone inválido. Inclua DDD + número.");
      setStep(2);
      return;
    }
    if (companyName.trim().length < 2) {
      toast.error("Informe seu nome / nome da empresa.");
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("complete_onboarding", {
        p_account_type: accountType,
        p_company_name: companyName.trim(),
        p_phone: phone.trim(),
        p_plan_slug: planSlug,
      });

      if (error) throw error;
      console.log("[Onboarding] complete result:", data);

      await refreshProfile();
      toast.success("Tudo pronto! Bem-vindo(a) à plataforma.");
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      console.error("[Onboarding] complete error:", e);
      const msg = String(e?.message || "");
      if (msg.includes("phone_already_registered")) {
        setPhoneTaken(true);
        toast.error("Este número já está cadastrado em outra conta. Use outro telefone.");
        setStep(2);
      } else {
        toast.error("Não foi possível concluir o onboarding. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Steps ───
  const steps = useMemo(() => [
    // 0 — Welcome
    {
      title: "Bem-vindo ao Porta do Corretor! 🎉",
      subtitle: "Vamos configurar sua conta em 1 minuto.",
      content: (
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center max-w-sm space-y-2">
            <p className="text-foreground font-medium">
              {profile?.full_name ? `Olá, ${profile.full_name.split(" ")[0]}!` : "Olá!"}
            </p>
            <p className="text-muted-foreground text-sm">
              Responda 3 perguntas rápidas para personalizar a plataforma.
            </p>
          </div>
        </div>
      ),
      canProceed: true,
    },
    // 1 — Account type
    {
      title: "Como você atua?",
      subtitle: "Isso define como sua conta será organizada.",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACCOUNT_TYPES.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setAccountType(value)}
              className={cn(
                "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center",
                accountType === value
                  ? "border-primary bg-primary/5 text-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-accent/50 hover:border-border/80"
              )}
            >
              <Icon className="h-7 w-7" />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      ),
      canProceed: !!accountType,
    },
    // 2 — Company name + phone
    {
      title: accountType === "imobiliaria" ? "Dados da empresa" : "Seus dados",
      subtitle: "Usaremos essas informações no seu perfil e contato.",
      content: (
        <div className="space-y-4 max-w-md mx-auto">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              {accountType === "imobiliaria" ? "Nome da imobiliária" : "Seu nome profissional"}
            </Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={accountType === "imobiliaria" ? "Ex: Imobiliária Habitae" : "Ex: João Silva"}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp / Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className={cn("pl-9", phoneTaken && "border-destructive focus-visible:ring-destructive")}
                aria-invalid={phoneTaken}
              />
              {phoneChecking && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {phoneTaken && (
              <p className="text-xs text-destructive">
                Este número já está cadastrado em outra conta. Use outro telefone.
              </p>
            )}
          </div>
        </div>
      ),
      canProceed:
        companyName.trim().length >= 2 &&
        phone.replace(/\D/g, "").length >= 10 &&
        !phoneTaken &&
        !phoneChecking,
    },
    // 3 — Plan
    {
      title: "Escolha um plano",
      subtitle: "Você pode mudar quando quiser. O Gratuito tem 15 dias completos.",
      content: plansLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
          {plans.map((plan) => {
            const isFree = plan.slug === "gratuito";
            const selected = planSlug === plan.slug;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanSlug(plan.slug)}
                className={cn(
                  "flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left",
                  selected
                    ? "border-primary bg-primary/5 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-accent/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                  {isFree && (
                    <span className="text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">
                      Recomendado
                    </span>
                  )}
                </div>
                <span className="text-lg font-bold text-foreground">
                  {isFree ? "Grátis" : `${formatBRL(plan.price_monthly)}/mês`}
                </span>
                {plan.trial_days && plan.trial_days > 0 && !isFree && (
                  <span className="text-xs text-muted-foreground">
                    {plan.trial_days} dias grátis para testar
                  </span>
                )}
                {plan.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2">{plan.description}</span>
                )}
              </button>
            );
          })}
        </div>
      ),
      canProceed: !!planSlug && !plansLoading,
    },
    // 4 — Ready
    {
      title: "Tudo pronto! 🚀",
      subtitle: "Sua conta está configurada.",
      content: (
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div className="text-center max-w-sm space-y-3">
            <p className="text-foreground font-medium">Vamos para o dashboard!</p>
            <p className="text-muted-foreground text-sm">
              Cadastre imóveis, organize seus leads e teste todas as ferramentas.
            </p>
          </div>
        </div>
      ),
      canProceed: true,
    },
  ], [accountType, companyName, phone, planSlug, plans, plansLoading, profile?.full_name]);

  // Quando entra em "planOnlyMode" (legacy sem subscription), pula direto para o passo de plano.
  useEffect(() => {
    if (planOnlyMode === true) setStep(3);
  }, [planOnlyMode]);

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const totalSteps = steps.length;

  // Loader enquanto verificamos se o usuário (já com onboarding completo) precisa apenas do plano.
  if (planOnlyMode === null && profile?.onboarding_completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant opacity-50" />

      <header className="relative z-10 flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <HabitaeLogo variant="icon" size="sm" />
          <span className="font-display text-lg font-bold text-foreground">Porta do Corretor</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
          disabled={saving}
        >
          Sair
        </Button>
      </header>

      <div className="relative z-10 px-6 sm:px-8 max-w-lg mx-auto w-full">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full flex-1 transition-all duration-500",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Passo {step + 1} de {totalSteps}</p>
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-lg space-y-6 page-enter" key={step}>
          <div className="text-center space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{currentStep.title}</h1>
            <p className="text-muted-foreground text-sm">{currentStep.subtitle}</p>
          </div>
          {currentStep.content}
        </div>
      </main>

      <footer className="relative z-10 p-4 sm:p-6 flex justify-between items-center max-w-lg mx-auto w-full">
        {step > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} disabled={saving}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        ) : <div />}
        <Button
          variant="gold"
          size="lg"
          disabled={!currentStep.canProceed || saving}
          onClick={() => isLastStep ? finish() : setStep(step + 1)}
          className="min-w-[160px]"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLastStep ? (
            <>Ir para o Dashboard <ArrowRight className="h-4 w-4 ml-1" /></>
          ) : (
            <>Continuar <ArrowRight className="h-4 w-4 ml-1" /></>
          )}
        </Button>
      </footer>
    </div>
  );
}
