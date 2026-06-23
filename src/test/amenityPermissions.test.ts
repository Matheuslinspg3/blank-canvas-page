import { describe, it, expect } from "vitest";
import { isGlobalAmenity, canEditAmenity, canDeleteAmenity } from "@/lib/amenityPermissions";

const global = { organization_id: null, created_by: null, is_default: true };
const orgOwn = { organization_id: "org-A", created_by: "user-1", is_default: false };
const orgOther = { organization_id: "org-A", created_by: "user-2", is_default: false };
const orgDefault = { organization_id: "org-A", created_by: null, is_default: true };

describe("amenityPermissions", () => {
  it("flags global amenities (organization_id null)", () => {
    expect(isGlobalAmenity(global)).toBe(true);
    expect(isGlobalAmenity(orgOwn)).toBe(false);
  });

  describe("canEditAmenity", () => {
    it("never allows editing global items, even for admins", () => {
      expect(canEditAmenity(global, { userId: "u", isAdminLike: true })).toBe(false);
    });
    it("allows admin-like users on any item of the org", () => {
      expect(canEditAmenity(orgOther, { userId: "user-1", isAdminLike: true })).toBe(true);
    });
    it("allows creator on their own item", () => {
      expect(canEditAmenity(orgOwn, { userId: "user-1", isAdminLike: false })).toBe(true);
    });
    it("blocks non-admin non-creator", () => {
      expect(canEditAmenity(orgOther, { userId: "user-1", isAdminLike: false })).toBe(false);
    });
  });

  describe("canDeleteAmenity", () => {
    it("never deletes globals", () => {
      expect(canDeleteAmenity(global, { userId: "u", isAdminLike: true })).toBe(false);
    });
    it("never deletes default seeds even within the org", () => {
      expect(canDeleteAmenity(orgDefault, { userId: "user-1", isAdminLike: true })).toBe(false);
    });
    it("allows admin on regular org items", () => {
      expect(canDeleteAmenity(orgOther, { userId: "user-1", isAdminLike: true })).toBe(true);
    });
  });
});
