import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Minus, ShoppingCart, Sparkles } from "lucide-react";
import {
  Building2, UserCheck, Users, LayoutGrid, DollarSign, MessageCircle,
  Palette, FileText, Megaphone, FileSignature, Rss, Shield, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckoutDialog } from "./CheckoutDialog";
import { useSubscription } from "@/hooks/useSubscription";

const iconMap: Record<string, React.ElementType> = {
  Building2, UserCheck, Users, LayoutGrid, DollarSign, MessageCircle,
  Palette, FileText, Megaphone, FileSignature, Rss, Shield, Zap, Sparkles,
};

const categoryLabels: Record<string, string> = {
  gestao: "Gestão",
  marketing: "Marketing",
  ia: "Inteligência Artificial",
  integracao: "Integrações",
};

const categoryOrder = ["gestao", "marketing", "ia", "integracao"];

export interface PlanModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  feature_key: string;
  feature_value: any;
  category: string;
  icon: string;
  display_order: number;
}

interface Selection {
  moduleId: string;
  quantity: number;
}

export function CustomPlanBuilder() {
  const [isYearly, setIsYearly] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { subscription } = useSubscription();

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["plan-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_modules")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as PlanModule[];
    },
  });

  const isNumeric = (mod: PlanModule) => typeof mod.feature_value === "number" || !isNaN(Number(mod.feature_value));

  const toggle = (moduleId: string) => {
    setSelections((prev) => {
      const exists = prev.find((s) => s.moduleId === moduleId);
      if (exists) return prev.filter((s) => s.moduleId !== moduleId);
      return [...prev, { moduleId, quantity: 1 }];
    });
  };

  const setQty = (moduleId: string, qty: number) => {
    if (qty < 1) return;
    setSelections((prev) =>
      prev.map((s) => (s.moduleId === moduleId ? { ...s, quantity: qty } : s))
    );
  };

  const isSelected = (moduleId: string) => selections.some((s) => s.moduleId === moduleId);

  const totalPrice = useMemo(() => {
    return selections.reduce((sum, sel) => {
      const mod = modules.find((m) => m.id === sel.moduleId);
      if (!mod) return sum;
      const price = isYearly ? mod.price_yearly : mod.price_monthly;
      const qty = isNumeric(mod) ? sel.quantity : 1;
      return sum + price * qty;
    }, 0);
  }, [selections, modules, isYearly]);

  const monthlyEquiv = isYearly ? totalPrice / 12 : totalPrice;

  const grouped = useMemo(() => {
    const groups: Record<string, PlanModule[]> = {};
    modules.forEach((m) => {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    });
    return groups;
  }, [modules]);

  // Build a fake plan for CheckoutDialog
  const customPlan = useMemo(() => {
    if (selections.length === 0) return null;
    return {
      id: "custom",
      name: "Personalizado",
      slug: "personalizado",
      description: `${selections.length} módulos selecionados`,
      price_monthly: totalPrice,
      price_yearly: isYearly ? totalPrice : totalPrice * 10, // 10 months = ~17% discount
      max_own_properties: null,
      max_users: null,
      max_leads: null,
      marketplace_access: false,
      partnership_access: false,
      priority_support: selections.some(s => {
        const m = modules.find(mod => mod.id === s.moduleId);
        return m?.feature_key === "priority_support";
      }),
      features: { line: "custom", custom: true },
      display_order: 99,
      plan_type: "custom",
    };
  }, [selections, totalPrice, isYearly, modules]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Monte seu Plano
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha apenas os módulos que você precisa e pague somente pelo que usar
        </p>
        <Badge variant="outline" className="text-xs gap-1 mx-auto">
          <Sparkles className="h-3 w-3" />
          7 dias grátis para testar
        </Badge>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm", !isYearly && "font-semibold")}>Mensal</span>
        <Switch checked={isYearly} onCheckedChange={setIsYearly} />
        <span className={cn("text-sm", isYearly && "font-semibold")}>
          Anual
          <Badge variant="secondary" className="ml-1.5 text-[10px]">Economia</Badge>
        </span>
      </div>

      {/* Module categories */}
      <div className="space-y-6">
        {categoryOrder.map((cat) => {
          const mods = grouped[cat];
          if (!mods || mods.length === 0) return null;
          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {categoryLabels[cat] || cat}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {mods.map((mod) => {
                  const Icon = iconMap[mod.icon] || Zap;
                  const selected = isSelected(mod.id);
                  const sel = selections.find((s) => s.moduleId === mod.id);
                  const qty = sel?.quantity || 1;
                  const numeric = isNumeric(mod);
                  const price = isYearly ? mod.price_yearly : mod.price_monthly;
                  const unitPrice = price / 100;
                  const displayPrice = numeric ? unitPrice * qty : unitPrice;

                  return (
                    <Card
                      key={mod.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selected && "ring-2 ring-primary bg-primary/5"
                      )}
                      onClick={() => toggle(mod.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggle(mod.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5"
                          />
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{mod.name}</p>
                              <p className="text-sm font-bold text-primary whitespace-nowrap">
                                R$ {displayPrice.toFixed(2).replace(".", ",")}
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  /{isYearly ? "ano" : "mês"}
                                </span>
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">{mod.description}</p>

                            {/* Quantity control for numeric modules */}
                            {selected && numeric && (
                              <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setQty(mod.id, qty - 1)}
                                  disabled={qty <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-medium w-8 text-center">{qty}x</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setQty(mod.id, qty + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  = {Number(mod.feature_value) * qty} {mod.feature_key.replace("max_", "").replace("_", " ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {selections.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-muted/30">
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                {selections.length} {selections.length === 1 ? "módulo" : "módulos"} selecionados
              </p>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold">
                  R$ {(monthlyEquiv / 100).toFixed(2).replace(".", ",")}
                </p>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
              {isYearly && (
                <p className="text-xs text-muted-foreground">
                  R$ {(totalPrice / 100).toFixed(2).replace(".", ",")}/ano
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setCheckoutOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              Testar 7 dias grátis
            </Button>
          </div>
        </>
      )}

      {customPlan && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          plan={customPlan as any}
          customModules={selections.map((s) => ({
            moduleId: s.moduleId,
            quantity: s.quantity,
          }))}
        />
      )}
    </div>
  );
}
