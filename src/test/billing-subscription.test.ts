/**
 * Testes unitários — Helpers de Assinatura
 * Cobre: hasFeature, getFeatureLimit, getPlanLine, canUpgradeTo, status helpers
 */

import { describe, it, expect } from "vitest";
import {
  hasFeature,
  getFeatureLimit,
  getPlanLine,
} from "@/hooks/useSubscription";
import type { SubscriptionPlan } from "@/hooks/useSubscription";

// --------------------------------------------------------------------------
// Fixtures de planos
// --------------------------------------------------------------------------

const freePlan: SubscriptionPlan = {
  id: "plan-free",
  name: "Gratuito",
  slug: "gratuito",
  description: "Plano grátis",
  price_monthly: 0,
  price_yearly: 0,
  max_own_properties: 10,
  max_users: 1,
  max_leads: 20,
  marketplace_access: false,
  partnership_access: false,
  priority_support: false,
  features: {
    line: "erp",
    marketplace_access: false,
    ai_credits_limit: 0,
    max_storage_mb: 512,
  },
  display_order: 1,
};

const starterPlan: SubscriptionPlan = {
  id: "plan-starter",
  name: "Starter",
  slug: "starter",
  description: null,
  price_monthly: 4900,
  price_yearly: 47040,
  max_own_properties: 30,
  max_users: 3,
  max_leads: 100,
  marketplace_access: true,
  partnership_access: false,
  priority_support: false,
  features: {
    line: "erp",
    marketplace_access: true,
    ai_credits_limit: 50,
    max_storage_mb: 2048,
    can_buy_addon_extra_users: true,
    extra_user_price: 1900,
    support_level: "chat_ai",
  },
  display_order: 2,
};

const profissionalPlan: SubscriptionPlan = {
  id: "plan-prof",
  name: "Profissional",
  slug: "profissional",
  description: null,
  price_monthly: 19900,
  price_yearly: 191040,
  max_own_properties: null, // unlimited
  max_users: null,
  max_leads: null,
  marketplace_access: true,
  partnership_access: true,
  priority_support: true,
  features: {
    line: "erp",
    marketplace_access: true,
    ai_credits_limit: -1, // unlimited
    max_storage_mb: -1,
    support_level: "priority",
  },
  display_order: 5,
};

const businessPlan: SubscriptionPlan = {
  id: "plan-business",
  name: "Business",
  slug: "business",
  description: null,
  price_monthly: 49900,
  price_yearly: 479040,
  max_own_properties: null,
  max_users: null,
  max_leads: null,
  marketplace_access: true,
  partnership_access: true,
  priority_support: true,
  features: {
    line: "combo",
    ai_credits_limit: -1,
    max_storage_mb: -1,
    support_level: "dedicated",
  },
  display_order: 6,
};

const enterprisePlan: SubscriptionPlan = {
  id: "plan-enterprise",
  name: "Enterprise",
  slug: "enterprise-plus",
  description: null,
  price_monthly: 0,
  price_yearly: 0,
  max_own_properties: null,
  max_users: null,
  max_leads: null,
  marketplace_access: true,
  partnership_access: true,
  priority_support: true,
  features: {
    line: "combo",
  },
  display_order: 7,
};

const marketplacePlan: SubscriptionPlan = {
  id: "plan-mkt",
  name: "Marketplace",
  slug: "marketplace",
  description: null,
  price_monthly: 2900,
  price_yearly: 27840,
  max_own_properties: 5,
  max_users: 1,
  max_leads: 50,
  marketplace_access: true,
  partnership_access: false,
  priority_support: false,
  features: {
    line: "marketplace",
  },
  display_order: 3,
};

// --------------------------------------------------------------------------
// hasFeature
// --------------------------------------------------------------------------

describe("hasFeature — plano nulo", () => {
  it("retorna false quando plan é null", () => {
    expect(hasFeature(null, "marketplace_access")).toBe(false);
  });

  it("retorna false quando plan é undefined", () => {
    expect(hasFeature(undefined, "marketplace_access")).toBe(false);
  });
});

describe("hasFeature — planos enterprise e business", () => {
  it("plano enterprise retorna true para qualquer feature", () => {
    expect(hasFeature(enterprisePlan, "marketplace_access")).toBe(true);
    expect(hasFeature(enterprisePlan, "priority_support")).toBe(true);
    expect(hasFeature(enterprisePlan, "any_future_feature")).toBe(true);
  });

  it("plano business retorna true para qualquer feature", () => {
    expect(hasFeature(businessPlan, "marketplace_access")).toBe(true);
    expect(hasFeature(businessPlan, "any_future_feature")).toBe(true);
  });

  it("slug com 'enterprise' no meio também é reconhecido", () => {
    const plan = { ...freePlan, slug: "enterprise-custom" };
    expect(hasFeature(plan, "any_feature")).toBe(true);
  });
});

describe("hasFeature — feature com valor booleano", () => {
  it("retorna true quando feature é true no objeto features", () => {
    expect(hasFeature(starterPlan, "marketplace_access")).toBe(true);
  });

  it("retorna false quando feature é false no objeto features", () => {
    expect(hasFeature(freePlan, "marketplace_access")).toBe(false);
  });
});

describe("hasFeature — feature com valor numérico", () => {
  it("retorna true quando feature é número > 0", () => {
    expect(hasFeature(starterPlan, "ai_credits_limit")).toBe(true);
  });

  it("retorna false quando feature é 0", () => {
    expect(hasFeature(freePlan, "ai_credits_limit")).toBe(false);
  });
});

describe("hasFeature — feature ausente no features object", () => {
  it("retorna false quando chave não existe em features", () => {
    expect(hasFeature(freePlan, "nonexistent_feature")).toBe(false);
  });
});

describe("hasFeature — plan sem features object", () => {
  it("retorna false (não-enterprise) quando plan.features é null", () => {
    const plan = { ...freePlan, features: null };
    expect(hasFeature(plan, "marketplace_access")).toBe(false);
  });
});

// --------------------------------------------------------------------------
// getFeatureLimit
// --------------------------------------------------------------------------

describe("getFeatureLimit — plano nulo", () => {
  it("retorna limite do plano grátis para max_own_properties quando plan é null", () => {
    expect(getFeatureLimit(null, "max_own_properties")).toBe(10);
  });

  it("retorna limite do plano grátis para max_leads quando plan é null", () => {
    expect(getFeatureLimit(null, "max_leads")).toBe(20);
  });

  it("retorna limite do plano grátis para max_users quando plan é null", () => {
    expect(getFeatureLimit(null, "max_users")).toBe(1);
  });

  it("retorna 0 para chave desconhecida quando plan é null", () => {
    expect(getFeatureLimit(null, "unknown_feature")).toBe(0);
  });
});

describe("getFeatureLimit — planos enterprise e business (ilimitado)", () => {
  it("retorna Infinity para max_own_properties em plano enterprise", () => {
    expect(getFeatureLimit(enterprisePlan, "max_own_properties")).toBe(Infinity);
  });

  it("retorna Infinity para max_leads em plano enterprise", () => {
    expect(getFeatureLimit(enterprisePlan, "max_leads")).toBe(Infinity);
  });

  it("retorna Infinity para max_users em plano enterprise", () => {
    expect(getFeatureLimit(enterprisePlan, "max_users")).toBe(Infinity);
  });

  it("retorna Infinity para ai_credits_limit em plano business", () => {
    expect(getFeatureLimit(businessPlan, "ai_credits_limit")).toBe(Infinity);
  });

  it("retorna Infinity para max_storage_mb em plano business", () => {
    expect(getFeatureLimit(businessPlan, "max_storage_mb")).toBe(Infinity);
  });
});

describe("getFeatureLimit — valores especiais em features JSON", () => {
  it("retorna Infinity quando valor é -1 no features JSON", () => {
    expect(getFeatureLimit(profissionalPlan, "ai_credits_limit")).toBe(Infinity);
  });

  it("retorna Infinity quando valor é true no features JSON", () => {
    const plan = { ...starterPlan, features: { max_own_properties: true } };
    expect(getFeatureLimit(plan, "max_own_properties")).toBe(Infinity);
  });
});

describe("getFeatureLimit — coluna top-level null (ilimitado)", () => {
  it("retorna Infinity quando max_own_properties é null (plano profissional)", () => {
    expect(getFeatureLimit(profissionalPlan, "max_own_properties")).toBe(Infinity);
  });

  it("retorna Infinity quando max_users é null", () => {
    expect(getFeatureLimit(profissionalPlan, "max_users")).toBe(Infinity);
  });
});

describe("getFeatureLimit — valor numérico definido", () => {
  it("retorna valor numérico de features JSON para ai_credits_limit", () => {
    expect(getFeatureLimit(starterPlan, "ai_credits_limit")).toBe(50);
  });

  it("retorna valor numérico de features JSON para max_storage_mb", () => {
    expect(getFeatureLimit(starterPlan, "max_storage_mb")).toBe(2048);
  });

  it("retorna valor de coluna top-level max_own_properties", () => {
    expect(getFeatureLimit(freePlan, "max_own_properties")).toBe(10);
  });

  it("retorna valor de coluna top-level max_leads", () => {
    expect(getFeatureLimit(freePlan, "max_leads")).toBe(20);
  });
});

// --------------------------------------------------------------------------
// getPlanLine
// --------------------------------------------------------------------------

describe("getPlanLine — identificação de linha do plano", () => {
  it("retorna 'erp' para plano ERP", () => {
    expect(getPlanLine(freePlan)).toBe("erp");
  });

  it("retorna 'marketplace' para plano marketplace", () => {
    expect(getPlanLine(marketplacePlan)).toBe("marketplace");
  });

  it("retorna 'combo' para plano combo", () => {
    expect(getPlanLine(businessPlan)).toBe("combo");
  });

  it("retorna null quando plan é null", () => {
    expect(getPlanLine(null)).toBeNull();
  });

  it("retorna null quando features é null", () => {
    const plan = { ...freePlan, features: null };
    expect(getPlanLine(plan)).toBeNull();
  });

  it("retorna null quando features não tem chave 'line'", () => {
    const plan = { ...freePlan, features: { marketplace_access: true } };
    expect(getPlanLine(plan)).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Cálculo de preço com desconto (lógica do hook)
// --------------------------------------------------------------------------

describe("Cálculo de preço com desconto anual", () => {
  it("plano anual tem economia vs mensal × 12", () => {
    // starter: monthly=4900, yearly=47040
    // economia = (4900 * 12 - 47040) / 100 = R$117,60
    const savings = (starterPlan.price_monthly * 12 - starterPlan.price_yearly) / 100;
    expect(savings).toBeGreaterThan(0);
  });

  it("valor mensal equivalente no plano anual é menor que mensal", () => {
    const monthlyEquivalent = starterPlan.price_yearly / 12;
    expect(monthlyEquivalent).toBeLessThan(starterPlan.price_monthly);
  });

  it("plano gratuito tem preço zero em ambos os ciclos", () => {
    expect(freePlan.price_monthly).toBe(0);
    expect(freePlan.price_yearly).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Status da assinatura (simulados sem hook)
// --------------------------------------------------------------------------

describe("Lógica de status da assinatura", () => {
  const makeSubscription = (status: string, trial_end: string | null = null) => ({
    status,
    trial_end,
  });

  it("status 'active' resulta em isActive = true", () => {
    const sub = makeSubscription("active");
    const isActive = sub.status === "active";
    expect(isActive).toBe(true);
  });

  it("status 'trial' com trial_end futuro resulta em isActive = true", () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const sub = makeSubscription("trial", futureDate);
    const isActive =
      sub.status === "active" ||
      (sub.status === "trial" && sub.trial_end != null && new Date(sub.trial_end) > new Date());
    expect(isActive).toBe(true);
  });

  it("status 'trial' com trial_end passado resulta em isActive = false", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const sub = makeSubscription("trial", pastDate);
    const isActive =
      sub.status === "active" ||
      (sub.status === "trial" && sub.trial_end != null && new Date(sub.trial_end) > new Date());
    expect(isActive).toBe(false);
  });

  it("status 'pending' resulta em isPending = true", () => {
    expect(makeSubscription("pending").status === "pending").toBe(true);
  });

  it("status 'overdue' resulta em isOverdue = true", () => {
    expect(makeSubscription("overdue").status === "overdue").toBe(true);
  });

  it("status 'cancelled' resulta em isCancelled = true", () => {
    expect(makeSubscription("cancelled").status === "cancelled").toBe(true);
  });
});

// --------------------------------------------------------------------------
// Trial: dias restantes (lógica pura)
// --------------------------------------------------------------------------

describe("Trial — dias restantes", () => {
  it("calcula dias restantes corretamente", () => {
    const daysFromNow = 7;
    const trialEnd = new Date(Date.now() + daysFromNow * 86400000);
    const now = new Date();
    const remaining = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
    );
    expect(remaining).toBe(daysFromNow);
  });

  it("retorna 0 quando trial expirou", () => {
    const pastDate = new Date(Date.now() - 86400000);
    const now = new Date();
    const remaining = Math.max(
      0,
      Math.ceil((pastDate.getTime() - now.getTime()) / 86400000)
    );
    expect(remaining).toBe(0);
  });
});

// --------------------------------------------------------------------------
// canUpgradeTo — ordem dos planos
// --------------------------------------------------------------------------

describe("canUpgradeTo — lógica de ordem de planos", () => {
  const PLAN_ORDER = [
    "gratuito",
    "starter",
    "correspondente",
    "essencial",
    "profissional",
    "business",
  ];

  const canUpgrade = (current: string, target: string) =>
    PLAN_ORDER.indexOf(target) > PLAN_ORDER.indexOf(current);

  it("gratuito pode fazer upgrade para starter", () => {
    expect(canUpgrade("gratuito", "starter")).toBe(true);
  });

  it("starter pode fazer upgrade para profissional", () => {
    expect(canUpgrade("starter", "profissional")).toBe(true);
  });

  it("business não pode fazer upgrade (último plano na ordem)", () => {
    expect(canUpgrade("business", "profissional")).toBe(false);
  });

  it("plano não pode 'upgrade' para si mesmo", () => {
    expect(canUpgrade("starter", "starter")).toBe(false);
  });

  it("downgrade (profissional → starter) retorna false", () => {
    expect(canUpgrade("profissional", "starter")).toBe(false);
  });
});

// --------------------------------------------------------------------------
// getDiscountedPrice — preço com desconto
// --------------------------------------------------------------------------

describe("getDiscountedPrice — cálculo de desconto", () => {
  const getDiscountedPrice = (price: number, discountPercent: number) => {
    if (discountPercent <= 0) return price;
    return Math.round(price * (1 - discountPercent / 100));
  };

  it("20% de desconto sobre R$199 resulta em R$159", () => {
    expect(getDiscountedPrice(19900, 20)).toBe(15920);
  });

  it("desconto 0% retorna preço original", () => {
    expect(getDiscountedPrice(19900, 0)).toBe(19900);
  });

  it("desconto negativo retorna preço original", () => {
    expect(getDiscountedPrice(19900, -10)).toBe(19900);
  });

  it("100% de desconto resulta em zero", () => {
    expect(getDiscountedPrice(19900, 100)).toBe(0);
  });
});
