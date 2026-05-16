import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import portaLogo3D from "@/assets/porta-logo-3d.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users, Building2, CalendarDays, Wallet, Globe,
  ArrowRight, Check, Zap, Shield, BarChart3,
  Star, Rocket, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isPublicCommercialPlan } from "@/lib/planLimits";

/* ─── Helpers ─── */
const fmt = (value: number | null | undefined) =>
  ((value ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Section wrapper ─── */


const Section = React.forwardRef<HTMLElement, { children: React.ReactNode; className?: string; id?: string }>(
  ({ children, className, id }, ref) => (
    <section ref={ref} id={id} className={cn("py-16 md:py-24 px-4", className)}>
      <div className="container max-w-6xl mx-auto">{children}</div>
    </section>
  )
);
Section.displayName = "Section";

/* ─── Features data ─── */
const features = [
  { icon: Users, title: "CRM", desc: "Gerencie leads e acompanhe oportunidades com limites claros para cada plano." },
  { icon: Building2, title: "Gestão de Imóveis", desc: "Cadastre, organize e publique seus imóveis no marketplace conforme o pacote contratado." },
  { icon: CalendarDays, title: "Agenda", desc: "Organize visitas, compromissos e rotinas comerciais em uma agenda integrada." },
  { icon: Globe, title: "Marketplace", desc: "Publique imóveis no marketplace e amplie seu alcance para compradores." },
  { icon: Wallet, title: "Financeiro", desc: "Acompanhe receitas, despesas e dados financeiros da operação." },
  { icon: BarChart3, title: "Relatórios", desc: "Disponível no Plano Imobiliária para gestão com visão de equipe e resultados." },
];

const steps = [
  { num: "01", title: "Crie sua conta", desc: "Cadastro gratuito em menos de 2 minutos. Sem cartão de crédito para testar." },
  { num: "02", title: "Configure seus imóveis", desc: "Cadastre seus imóveis e comece a organizar a operação." },
  { num: "03", title: "Escolha seu plano", desc: "Assine Starter, Essencial, Profissional ou Imobiliária após o trial de 15 dias." },
];

const faqs = [
  { q: "Preciso de cartão de crédito para começar?", a: "Não. Você pode iniciar um trial de 15 dias sem cartão." },
  { q: "Quais planos estão disponíveis?", a: "Os planos públicos são Starter, Essencial, Profissional e Imobiliária." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem multa e sem burocracia. Você mantém acesso até o fim do período pago." },
];

/* ─── Hero with 3D Parallax Logo ─── */
function HeroSection() {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // rotateY follows X axis, rotateX follows Y axis (inverted)
        setRotateY(((e.clientX - cx) / (rect.width / 2)) * 25);
        setRotateX(-((e.clientY - cy) / (rect.height / 2)) * 15);
      });
    },
    [isMobile]
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setRotateX(0);
    setRotateY(0);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const logoTransform = isMobile
    ? undefined
    : `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden py-20 md:py-32 px-4 text-center"
      style={{ perspective: "1200px" }}
    >
      {/* Layer 1 — 3D Logo background */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ transformStyle: "preserve-3d" }}
      >
        <img
          src={portaLogo3D}
          alt=""
          aria-hidden
          className={cn(
            "pointer-events-none max-w-[70%] max-h-[80%] object-contain opacity-[0.35]",
            "transition-transform duration-300 ease-out will-change-transform",
            "drop-shadow-[0_0_60px_hsl(var(--accent)/0.3)]",
            isMobile && "animate-float-3d"
          )}
          style={{
            transform: logoTransform,
            transformStyle: "preserve-3d",
          }}
        />
      </div>

      {/* Layer 2 — Overlay gradient for legibility */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />

      {/* Layer 3 — Content */}
      <div className="relative z-20 container max-w-6xl mx-auto">
        <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
          <Rocket className="h-3.5 w-3.5 mr-1.5" />
          Plataforma #1 para corretores de imóveis
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] max-w-3xl mx-auto">
          Gerencie sua imobiliária com{" "}
          <span className="text-accent">CRM, agenda e marketplace</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          CRM, marketplace de imóveis, agenda e financeiro — tudo em uma plataforma feita para
          corretores que querem organizar a operação e vender mais.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="gold" size="xl" asChild>
            <Link to="/auth?tab=cadastro">
              Teste grátis por 15 dias
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/planos">Ver planos</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Sem cartão de crédito · Cancele quando quiser
        </p>
      </div>
    </section>
  );
}
export default function LandingPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [session, loading, navigate]);

  // Fetch plans for pricing section
  const { data: plans } = useQuery({
    queryKey: ["landing-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, slug, price_monthly, price_yearly, max_own_properties, max_leads, marketplace_access, features, is_active, plan_type")
        .eq("is_active", true)
        .eq("plan_type", "plan")
        .order("display_order", { ascending: true });
      return (data ?? []).filter(isPublicCommercialPlan);
    },
    staleTime: 10 * 60 * 1000,
  });

  // Show nothing while checking auth, or if logged in
  if (loading || session) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
          <HabitaeLogo size="sm" />
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/auth?tab=cadastro">Criar conta grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <HeroSection />

      {/* ─── Social Proof ─── */}
      <div className="border-y border-border bg-muted/50">
        <div className="container max-w-4xl mx-auto py-6 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">+500</span> corretores ativos
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">+10.000</span> imóveis cadastrados
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">4.9/5</span> de satisfação
          </div>
        </div>
      </div>

      {/* ─── Features ─── */}
      <Section id="funcionalidades" className="bg-background">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4">
            <Zap className="h-3.5 w-3.5 mr-1" /> Funcionalidades
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tudo que você precisa, em um só lugar</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Ferramentas profissionais para cada etapa do seu negócio imobiliário.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="group hover:shadow-lg hover:border-accent/30 transition-all duration-300">
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* ─── How it works ─── */}
      <Section className="bg-muted/40">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Como funciona</h2>
          <p className="mt-3 text-muted-foreground">Comece a usar em minutos, sem complicação.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xl font-bold mb-5">
                {s.num}
              </div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Pricing ─── */}
      <Section id="planos" className="bg-background">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4">
            <Clock className="h-3.5 w-3.5 mr-1" /> Planos
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Planos para cada fase do seu negócio</h2>
          <p className="mt-3 text-muted-foreground">Teste por 15 dias e escolha entre Starter, Essencial, Profissional ou Imobiliária.</p>
        </div>
        {plans && plans.length > 0 ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {plans.map((plan) => {
                const highlighted = plan.slug === "profissional";
                const planFeatures = (plan.features ?? {}) as Record<string, unknown>;
                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "relative transition-all duration-300",
                      highlighted && "border-accent shadow-lg scale-[1.02]"
                    )}
                  >
                    {highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-accent text-accent-foreground text-xs px-3">Popular</Badge>
                      </div>
                    )}
                    <CardContent className="p-6 text-center">
                      <h3 className="font-bold text-lg capitalize">{plan.name}</h3>
                      <div className="mt-4 mb-6">
                        {plan.price_monthly === 0 ? (
                          <span className="text-3xl font-bold">Grátis</span>
                        ) : (
                          <div>
                            <span className="text-3xl font-bold">R$ {fmt(plan.price_monthly)}</span>
                            <span className="text-muted-foreground text-sm">/mês</span>
                          </div>
                        )}
                      </div>
                      <ul className="text-sm space-y-2 text-left mb-6">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-accent shrink-0" />
                          {plan.max_own_properties === -1 ? "Imóveis ilimitados" : `${plan.max_own_properties ?? 0} imóveis cadastrados`}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-accent shrink-0" />
                          {plan.max_leads === -1 ? "Leads ilimitados no CRM" : `${plan.max_leads ?? 0} leads no CRM`}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-accent shrink-0" />
                          Agenda e financeiro
                        </li>
                        {planFeatures.has_import === true && (
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-accent shrink-0" />
                            CRM com integração
                          </li>
                        )}
                        {planFeatures.has_team_management === true && (
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-accent shrink-0" />
                            Gerenciamento de equipe
                          </li>
                        )}
                      </ul>
                      <Button
                        variant={highlighted ? "default" : "outline"}
                        className="w-full"
                        asChild
                      >
                        <Link to="/auth?tab=cadastro">
                          {plan.price_monthly === 0 ? "Começar grátis" : "Testar 15 dias grátis"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="text-center mt-8">
              <Button variant="link" asChild>
                <Link to="/planos">
                  Ver todos os planos e comparação detalhada <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <Button variant="gold" size="lg" asChild>
              <Link to="/planos">Ver planos disponíveis</Link>
            </Button>
          </div>
        )}
      </Section>

      {/* ─── Benefits / Trust ─── */}
      <Section className="bg-muted/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">
            Por que corretores escolhem o Porta
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-5 text-left">
            {[
              "Agenda, CRM e financeiro no mesmo lugar",
              "Marketplace de imóveis em todos os planos pagos",
              "Limites transparentes de imóveis e leads",
              "CRM com integração a partir do Profissional",
              "Equipe e relatórios no Plano Imobiliária",
              "Trial de 15 dias antes da primeira assinatura paga",
            ].map((b) => (
              <div key={b} className="flex items-start gap-3">
                <Check className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── FAQ ─── */}
      <Section id="faq" className="bg-background">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Perguntas frequentes</h2>
        </div>
        <div className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible>
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>

      {/* ─── Final CTA ─── */}
      <Section className="bg-primary text-primary-foreground text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Pronto para transformar sua imobiliária?
        </h2>
        <p className="mt-4 text-primary-foreground/80 text-lg max-w-lg mx-auto">
          Junte-se a corretores que organizam imóveis, leads e agenda no Porta do Corretor.
        </p>
        <Button
          size="xl"
          className="mt-8 bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg"
          asChild
        >
          <Link to="/auth?tab=cadastro">
            Criar minha conta grátis <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </Section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-muted/30 py-10 px-4">
        <div className="container max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <HabitaeLogo size="sm" />
          <div className="flex items-center gap-6">
            <Link to="/planos" className="hover:text-foreground transition-colors">Planos</Link>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <a href="https://wa.me/5562984459171" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Suporte</a>
          </div>
          <span>© {new Date().getFullYear()} Porta do Corretor</span>
        </div>
      </footer>
    </div>
  );
}
