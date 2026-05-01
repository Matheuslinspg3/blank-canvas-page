import type { Lead } from '@/hooks/useLeadCRUD';

/**
 * Returns true when a lead has at least one piece of "interest in property"
 * criteria filled in. Used to:
 *   - decide whether to show the "Sem critérios" badge on Kanban cards;
 *   - allow saving leads with no criteria without blocking;
 *   - never gate stage moves.
 *
 * Centralized here so UI surfaces stay consistent.
 */
export function leadHasCriteria(lead: Lead | null | undefined): boolean {
  if (!lead) return false;
  const l = lead as any;
  return Boolean(
    l.transaction_interest ||
      l.interested_property_type_id ||
      (Array.isArray(l.interested_property_type_ids) && l.interested_property_type_ids.length > 0) ||
      l.property_id ||
      l.estimated_value ||
      l.min_bedrooms ||
      l.min_bathrooms ||
      l.min_parking ||
      l.min_area ||
      (Array.isArray(l.preferred_neighborhoods) && l.preferred_neighborhoods.length > 0) ||
      (Array.isArray(l.preferred_cities) && l.preferred_cities.length > 0) ||
      (typeof l.additional_requirements === 'string' && l.additional_requirements.trim().length > 0),
  );
}
