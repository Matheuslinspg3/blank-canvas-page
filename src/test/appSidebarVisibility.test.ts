import { describe, expect, it } from "vitest";
import { getSidebarVisibilityFlags } from "@/components/AppSidebar";

describe("getSidebarVisibilityFlags", () => {
  it("shows Meu WhatsApp for authorized users", () => {
    const result = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasWhatsAppFeature: true,
      hasAutomationsFeature: false,
      rolesLoading: false,
      subscriptionLoading: false,
      hasAuthenticatedUser: true,
    });

    expect(result.shouldShowMyWhatsApp).toBe(true);
    expect(result.shouldShowAutomations).toBe(false);
  });

  it("keeps menu visible during transient loading for authenticated users", () => {
    const result = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasWhatsAppFeature: false,
      hasAutomationsFeature: false,
      rolesLoading: true,
      subscriptionLoading: false,
      hasAuthenticatedUser: true,
    });

    expect(result.shouldShowMyWhatsApp).toBe(true);
    expect(result.shouldShowAutomations).toBe(true);
  });

  it("does not keep menu visible during loading for non-authenticated users", () => {
    const result = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasWhatsAppFeature: false,
      hasAutomationsFeature: false,
      rolesLoading: true,
      subscriptionLoading: true,
      hasAuthenticatedUser: false,
    });

    expect(result.shouldShowMyWhatsApp).toBe(false);
    expect(result.shouldShowAutomations).toBe(false);
  });

  it("developer can still see both items", () => {
    const result = getSidebarVisibilityFlags({
      isDeveloper: true,
      hasWhatsAppFeature: false,
      hasAutomationsFeature: false,
      rolesLoading: false,
      subscriptionLoading: false,
      hasAuthenticatedUser: true,
    });

    expect(result.shouldShowMyWhatsApp).toBe(true);
    expect(result.shouldShowAutomations).toBe(true);
  });
});
