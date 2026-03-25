import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Check, Loader2, Crown, Zap, Building2, QrCode, CreditCard, Banknote,
  Eye, Search, Megaphone, Sparkles, Store, Briefcase, Rocket, Shield, Package,
  Puzzle,
} from "lucide-react";
import { useSubscription, type SubscriptionPlan } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CustomPlanBuilder } from "@/components/billing/CustomPlanBuilder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const slugIcons: Record<string, React.ElementType> = {
  visitante: Eye,
  explorador: Search,
  "corretor-mp": Megaphone,
  "corretor-mp-plus": Sparkles,
  "agencia-mp": Store,
  "erp-starter": Briefcase,
  "erp-profissional": Zap,
  "erp-business": Rocket,
  "erp-enterprise": Shield,
  "combo-corretor": Package,
  "combo-profissional": Package,
  "combo-business": Crown,
  "combo-enterprise": Building2,
};

function buildFeatureList(plan: SubscriptionPlan): string[] {
  const f: string[] = [];
  const features = plan.features as Record<string, any> | null;
  const line = features?.line;

  if (line === "marketplace") {
    if (features?.details_per_day != null) f.push(`${features.details_per_day} detalhes/dia`);
    else f.push("Detalhes ilimitados");
    if (features?.show_contact) f.push("Ver contato");
    if (features?.can_publish) {
      f.push(features.max_published ? `Publicar ${features.max_published} imóveis` : "Publicar ilimitado");
    }
    if (features?.ai_art_limit > 0) f.push(`${features.ai_art_limit} artes IA/mês`);
    if (features?.ai_text_limit > 0) f.push(`${features.ai_text_limit} textos IA/mês`);
    if (features?.ai_landing_limit > 0) f.push(`${features.ai_landing_limit} landing pages/mês`);
    if (features?.highlight_results) f.push("Destaque nos resultados");
    if (features?.partnerships) f.push("Parcerias");
    if (features?.broker_profile) f.push("Perfil público");
    if (features?.receive_leads) f.push("Receber leads");
    if (features?.verified_badge) f.push("Badge verificado");
    if (features?.alerts) f.push("Alertas");
    if (features?.max_favorites != null) f.push(`${features.max_favorites} favoritos`);
    else if (features?.max_favorites === null && plan.slug !== "visitante") f.push("Favoritos ilimitados");
  } else if (line === "erp") {
    if (plan.max_own_properties) f.push(`${plan.max_own_properties} imóveis`);
    else f.push("Imóveis ilimitados");
    if (plan.max_users) f.push(`${plan.max_users} usuário${plan.max_users > 1 ? "s" : ""}`);
    else f.push("Usuários ilimitados");
    if (plan.max_leads) f.push(`${plan.max_leads} leads`);
    else f.push("Leads ilimitados");
    if (features?.basic_crm) f.push("CRM Kanban");
    if (features?.financial) f.push("Financeiro");
    if (features?.whatsapp) f.push("WhatsApp");
    if (features?.ai_monthly_limit > 0) f.push(`${features.ai_monthly_limit} ações IA/mês`);
    if (features?.ai_art_limit > 0) f.push(`${features.ai_art_limit} artes IA/mês`);
    if (features?.meta_ads) f.push("Meta Ads");
    if (features?.rd_station) f.push("RD Station");
    if (features?.xml_feed) f.push("Feed XML");
    if (features?.automations_limit > 0) f.push(`${features.automations_limit} automações`);
    else if (features?.automations_limit === null) f.push("Automações ilimitadas");
    if (features?.imobzi_import) f.push("Imobzi");
    if (features?.contracts_ai) f.push("Contratos IA");
    if (features?.reports) f.push("Relatórios");
    if (features?.white_label) f.push("White label");
    if (features?.api_access) f.push("API");
    if (plan.priority_support) f.push("Suporte prioritário");
  } else if (line === "combo") {
    if (plan.max_own_properties) f.push(`${plan.max_own_properties} imóveis`);
    else f.push("Imóveis ilimitados");
    if (plan.max_users) f.push(`${plan.max_users} usuário${plan.max_users > 1 ? "s" : ""}`);
    else f.push("Usuários ilimitados");
    if (plan.max_leads) f.push(`${plan.max_leads} leads`);
    else f.push("Leads ilimitados");
    f.push("Marketplace + ERP");
    if (features?.marketplace?.can_publish) f.push("Publicar no marketplace");
    if (features?.erp?.whatsapp) f.push("WhatsApp");
    if (features?.erp?.financial) f.push("Financeiro");
    if (features?.erp?.meta_ads) f.push("Meta Ads");
    if (features?.erp?.contracts_ai) f.push("Contratos IA");
    if (plan.priority_support) f.push("Suporte prioritário");
  }

  return f;
}

const highlightSlugs = ["corretor-mp-plus", "erp-profissional", "combo-profissional"];

export function PlanCatalogDialog({ open, onOpenChange }: Props) {
  const { marketplacePlans, erpPlans, comboPlans, subscription, subscribe } = useSubscription({ enabled: open });
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [step, setStep] = useState<"plans" | "payment">("plans");
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string } | null>(null);
  const [tab, setTab] = useState("marketplace");

  const currentPlanId = subscription?.plan_id;

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlanId) return;
    setSelectedPlan(planId);
    setStep("payment");
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    try {
      const result = await subscribe.mutateAsync({
        planId: selectedPlan,
        billingCycle: isYearly ? "yearly" : "monthly",
        paymentMethod,
      });
      if (result.pixData) {
        setPixData({ qrCode: result.pixData.qrCode, copyPaste: result.pixData.copyPaste });
      } else {
        handleClose();
      }
    } catch { /* handled by mutation */ }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("plans");
    setSelectedPlan(null);
    setPixData(null);
  };

  const renderPlanCards = (plans: SubscriptionPlan[]) => (
    <div className="grid gap-3">
      {plans.map((plan) => {
        const Icon = slugIcons[plan.slug] || Zap;
        const isCurrent = plan.id === currentPlanId;
        const isHighlight = highlightSlugs.includes(plan.slug);
        const price = isYearly ? plan.price_yearly : plan.price_monthly;
        const monthlyEquiv = isYearly ? Number(plan.price_yearly) / 12 : Number(plan.price_monthly);
        const features = buildFeatureList(plan);
        const isFree = Number(plan.price_monthly) === 0;

        return (
          <Card
            key={plan.id}
            className={cn(
              "relative transition-all",
              isHighlight && "ring-2 ring-primary",
              isCurrent && "bg-primary/5"
            )}
          >
            {isHighlight && (
              <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                Mais popular
              </Badge>
            )}
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{plan.name}</h3>
                    {isCurrent && <Badge variant="outline" className="text-[10px]">Atual</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {features.slice(0, 6).map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Check className="h-3 w-3 text-primary" />
                        {f}
                      </span>
                    ))}
                    {features.length > 6 && (
                      <span className="text-[10px] text-muted-foreground">+{features.length - 6} mais</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isFree ? (
                    <p className="text-lg font-bold">Grátis</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold">
                        R$ {monthlyEquiv.toFixed(0)}
                        <span className="text-xs text-muted-foreground font-normal">/mês</span>
                      </p>
                      {isYearly && (
                        <p className="text-[10px] text-muted-foreground">
                          R$ {Number(price).toFixed(0)}/ano
                        </p>
                      )}
                    </>
                  )}
                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : isHighlight ? "default" : "outline"}
                    className="mt-2"
                    disabled={isCurrent}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isCurrent ? "Atual" : isFree ? "Ativar" : "Selecionar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pixData ? "Pagamento PIX" : step === "payment" ? "Forma de Pagamento" : "Escolha seu Plano"}
          </DialogTitle>
          <DialogDescription>
            {pixData
              ? "Escaneie o QR Code ou copie o código para pagar"
              : step === "payment"
                ? "Selecione como deseja pagar"
                : "Marketplace, ERP ou ambos — escolha o ideal para você"}
          </DialogDescription>
        </DialogHeader>

        {/* PIX QR Code Screen */}
        {pixData ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-background border rounded-xl">
              <img
                src={`data:image/png;base64,${pixData.qrCode}`}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground text-center">Ou copie o código:</p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all max-h-20 overflow-y-auto">
                  {pixData.copyPaste}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.copyPaste);
                    toast.success("Código copiado!");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Após o pagamento, sua assinatura será ativada automaticamente.
            </p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : step === "payment" ? (
          /* Payment Method Step */
          <div className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
              <label className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                paymentMethod === "pix" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value="pix" />
                <QrCode className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">PIX</p>
                  <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                paymentMethod === "credit" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value="credit" />
                <CreditCard className="h-5 w-5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Cartão de Crédito</p>
                  <p className="text-xs text-muted-foreground">Cobrança recorrente automática</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                paymentMethod === "debit" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value="debit" />
                <Banknote className="h-5 w-5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Boleto/Débito</p>
                  <p className="text-xs text-muted-foreground">Boleto bancário</p>
                </div>
              </label>
            </RadioGroup>

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("plans")} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSubscribe} disabled={subscribe.isPending} className="flex-1">
                {subscribe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assinar agora
              </Button>
            </div>
          </div>
        ) : (
          /* Plan Selection Step with Tabs */
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className={cn("text-sm", !isYearly && "font-semibold")}>Mensal</span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={cn("text-sm", isYearly && "font-semibold")}>
                Anual
                <Badge variant="secondary" className="ml-1.5 text-[10px]">Economia</Badge>
              </span>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="marketplace" className="flex-1 text-xs">
                  <Store className="h-3.5 w-3.5 mr-1" />
                  Marketplace
                </TabsTrigger>
                <TabsTrigger value="erp" className="flex-1 text-xs">
                  <Briefcase className="h-3.5 w-3.5 mr-1" />
                  ERP
                </TabsTrigger>
                <TabsTrigger value="combos" className="flex-1 text-xs">
                  <Package className="h-3.5 w-3.5 mr-1" />
                  Combos
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex-1 text-xs">
                  <Puzzle className="h-3.5 w-3.5 mr-1" />
                  Personalizado
                </TabsTrigger>
              </TabsList>

              <TabsContent value="marketplace" className="mt-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Para corretores que querem visibilidade e acesso a imóveis compartilhados.
                </p>
                {renderPlanCards(marketplacePlans)}
              </TabsContent>

              <TabsContent value="erp" className="mt-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Para imobiliárias que precisam de CRM, financeiro e gestão completa.
                </p>
                {renderPlanCards(erpPlans)}
              </TabsContent>

              <TabsContent value="combos" className="mt-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Marketplace + ERP juntos com <strong>20% de desconto</strong>.
                </p>
                {renderPlanCards(comboPlans)}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
