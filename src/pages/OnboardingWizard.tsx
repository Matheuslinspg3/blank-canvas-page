import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { cn } from "@/lib/utils";
import {
  Building2, User, Users, Briefcase, ArrowRight, ArrowLeft,
  Home, BarChart3, MessageSquare, Zap, CheckCircle2, Sparkles,
  Loader2
} from "lucide-react";

const TEAM_SIZES = [
  { value: "solo", label: "Só eu", icon: User, desc: "Corretor autônomo" },
  { value: "small", label: "2-5 pessoas", icon: Users, desc: "Equipe pequena" },
  { value: "medium", label: "6-20 pessoas", icon: Briefcase, desc: "Imobiliária média" },
  { value: "large", label: "20+ pessoas", icon: Building2, desc: "Imobiliária grande" },
];

const INTERESTS = [
  { value: "crm", label: "Gestão de Leads (CRM)", icon: Users, desc: "Organizar e acompanhar clientes" },
  { value: "properties", label: "Cadastro de Imóveis", icon: Home, desc: "Gerenciar carteira de imóveis" },
  { value: "marketplace", label: "Marketplace", icon: BarChart3, desc: "Publicar e encontrar imóveis" },
  { value: "whatsapp", label: "WhatsApp e Automações", icon: MessageSquare, desc: "Atendimento automatizado" },
  { value: "ai", label: "Inteligência Artificial", icon: Sparkles, desc: "Gerar textos, artes e análises" },
  { value: "financial", label: "Financeiro e Contratos", icon: Zap, desc: "Controlar finanças e comissões" },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (val: string) => {
    setInterests(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const finish = async () => {
    setSaving(true);
    try {
      // Save onboarding data to profile
      if (profile?.user_id) {
        await supabase.from("profiles").update({
          onboarding_completed: true,
        }).eq("user_id", profile.user_id);

        await refreshProfile();
      }
    } catch (e) {
      console.error("Onboarding save error:", e);
    }
    setSaving(false);
    navigate("/dashboard", { replace: true });
  };

  const steps = [
    // Step 0: Welcome
    {
      title: "Bem-vindo ao Porta do Corretor! 🎉",
      subtitle: "Vamos configurar sua experiência em poucos segundos.",
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
              Responda 2 perguntas rápidas para personalizar a plataforma para você.
            </p>
          </div>
        </div>
      ),
      canProceed: true,
    },
    // Step 1: Team size
    {
      title: "Qual o tamanho da sua equipe?",
      subtitle: "Isso nos ajuda a configurar os limites ideais.",
      content: (
        <div className="grid grid-cols-2 gap-3">
          {TEAM_SIZES.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTeamSize(value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                teamSize === value
                  ? "border-primary bg-primary/5 text-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-accent/50 hover:border-border/80"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      ),
      canProceed: !!teamSize,
    },
    // Step 2: Interests
    {
      title: "O que mais te interessa?",
      subtitle: "Selecione tudo que se aplica — você pode mudar depois.",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTERESTS.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleInterest(value)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-left",
                interests.includes(value)
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent/50"
              )}
            >
              <div className={cn(
                "mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                interests.includes(value) ? "bg-primary/10" : "bg-muted"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      ),
      canProceed: interests.length > 0,
    },
    // Step 3: Ready
    {
      title: "Tudo pronto! 🚀",
      subtitle: "Sua plataforma está configurada.",
      content: (
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <div className="text-center max-w-sm space-y-3">
            <p className="text-foreground font-medium">Seu teste gratuito já está ativo!</p>
            <p className="text-muted-foreground text-sm">
              Explore o dashboard, cadastre imóveis e comece a gerenciar seus leads agora mesmo.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {["Sem cartão", "Sem compromisso", "Cancele quando quiser"].map(t => (
                <span key={t} className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">{t}</span>
              ))}
            </div>
          </div>
        </div>
      ),
      canProceed: true,
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const totalSteps = steps.length;

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant opacity-50" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <HabitaeLogo variant="icon" size="sm" />
          <span className="font-display text-lg font-bold text-foreground">Porta do Corretor</span>
        </div>
        <button
          onClick={finish}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Pular
        </button>
      </header>

      {/* Progress */}
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

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-lg space-y-6 page-enter" key={step}>
          <div className="text-center space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{currentStep.title}</h1>
            <p className="text-muted-foreground text-sm">{currentStep.subtitle}</p>
          </div>

          {currentStep.content}
        </div>
      </main>

      {/* Footer nav */}
      <footer className="relative z-10 p-4 sm:p-6 flex justify-between items-center max-w-lg mx-auto w-full">
        {step > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        ) : (
          <div />
        )}
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
