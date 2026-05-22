import { describe, it, expect, vi } from "vitest";
import { getSidebarVisibilityFlags } from "../config/featureAccess";

describe("getSidebarVisibilityFlags", () => {
  const mockHasFeature = (key: string) => key === "has_whatsapp";

  it("returns true for features when not loading and user has access", () => {
    const flags = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasFeature: mockHasFeature,
      isLoadingAuth: false,
      isLoadingRoles: false,
      isLoadingSubscription: false,
      hasAuthenticatedUser: true,
    });

    expect(flags.showWhatsApp).toBe(true);
    expect(flags.showAutomations).toBe(false);
  });

  it("returns true for developer even without explicit feature", () => {
    const flags = getSidebarVisibilityFlags({
      isDeveloper: true,
      hasFeature: () => false,
      isLoadingAuth: false,
      isLoadingRoles: false,
      isLoadingSubscription: false,
      hasAuthenticatedUser: true,
    });

    expect(flags.showWhatsApp).toBe(true);
    expect(flags.showAutomations).toBe(true);
  });

  it("returns true for all features during transition (loading) if user is authenticated", () => {
    const flags = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasFeature: () => false, // No data yet
      isLoadingAuth: false,
      isLoadingRoles: true, // One is loading
      isLoadingSubscription: false,
      hasAuthenticatedUser: true,
    });

    // Fallback logic should keep them visible to avoid flicker
    expect(flags.showWhatsApp).toBe(true);
    expect(flags.showAutomations).toBe(true);
  });

  it("returns false during loading if NO user is authenticated (public state)", () => {
    const flags = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasFeature: () => false,
      isLoadingAuth: true,
      isLoadingRoles: true,
      isLoadingSubscription: true,
      hasAuthenticatedUser: false,
    });

    expect(flags.showWhatsApp).toBe(false);
    expect(flags.showAutomations).toBe(false);
  });

  it("returns false for non-developer without feature when NOT loading", () => {
    const flags = getSidebarVisibilityFlags({
      isDeveloper: false,
      hasFeature: () => false,
      isLoadingAuth: false,
      isLoadingRoles: false,
      isLoadingSubscription: false,
      hasAuthenticatedUser: true,
    });

    expect(flags.showWhatsApp).toBe(false);
    expect(flags.showAutomations).toBe(false);
  });
});
