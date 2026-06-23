import type { PropertyAmenity } from "@/hooks/usePropertyAmenities";

/** Globais: organization_id === null — read-only para todas as orgs. */
export function isGlobalAmenity(a: Pick<PropertyAmenity, "organization_id">): boolean {
  return a.organization_id === null;
}

/**
 * Quem pode editar uma característica:
 * - nunca globais
 * - admin/leader/developer da org pode editar qualquer item da própria org
 * - o criador pode editar o próprio item
 */
export function canEditAmenity(
  a: Pick<PropertyAmenity, "organization_id" | "created_by">,
  ctx: { userId: string | null | undefined; isAdminLike: boolean },
): boolean {
  if (isGlobalAmenity(a)) return false;
  if (ctx.isAdminLike) return true;
  return !!ctx.userId && a.created_by === ctx.userId;
}

/** Excluir: além das regras de edit, item `is_default` (sementes da org) também é protegido. */
export function canDeleteAmenity(
  a: Pick<PropertyAmenity, "organization_id" | "created_by" | "is_default">,
  ctx: { userId: string | null | undefined; isAdminLike: boolean },
): boolean {
  if (a.is_default) return false;
  return canEditAmenity(a, ctx);
}
