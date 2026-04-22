/**
 * Centralised field mapping for property batch/import operations.
 *
 * Some UI-facing fields (e.g. "notes") do NOT exist on the `properties`
 * table. This module defines:
 *   1. Which columns the grid shows and how they map to the DB.
 *   2. A helper to transform a UI row into a safe DB-ready object.
 *
 * Any component that collects or inserts variation data should import
 * from here instead of hard-coding column lists.
 */

// ---------------------------------------------------------------------------
// Grid column definitions (UI → DB)
// ---------------------------------------------------------------------------

export interface VariationColumnDef {
  /** Key used in the VariationRow object (UI-side). */
  key: string;
  /** Human-readable label shown in the grid header. */
  label: string;
  /** Input type rendered in the grid. */
  type: 'text' | 'number' | 'select';
  /** Optional placeholder for text/number inputs. */
  placeholder?: string;
  /**
   * If the UI key differs from the DB column, specify the DB column here.
   * `null` means this field has no direct DB column — it must be handled
   * by `applyFieldMappings`.
   */
  dbColumn?: string | null;
}

/**
 * Master column list consumed by `VariationsGrid`.
 *
 * 🔑 RULE: If a column here has `dbColumn: null`, it means it does NOT
 * exist on the `properties` table. `applyFieldMappings` will fold its
 * value into a valid DB field (e.g. notes → description).
 */
export const VARIATION_COLUMNS: readonly VariationColumnDef[] = [
  { key: 'property_code', label: 'Código', type: 'text', placeholder: 'Auto' },
  { key: 'unit_label', label: 'Unidade/Lote', type: 'text', placeholder: 'Ex: Casa 1' },
  { key: 'bedrooms', label: 'Quartos', type: 'number' },
  { key: 'suites', label: 'Suítes', type: 'number' },
  { key: 'bathrooms', label: 'Banheiros', type: 'number' },
  { key: 'parking_spots', label: 'Vagas', type: 'number' },
  { key: 'area_useful', label: 'Área Útil', type: 'number' },
  { key: 'area_total', label: 'Área Total', type: 'number' },
  { key: 'sale_price', label: 'Valor (R$)', type: 'number' },
  { key: 'status', label: 'Status', type: 'select' },
  // `notes` does NOT exist on the properties table → fold into description
  { key: 'notes', label: 'Observação', type: 'text', placeholder: '', dbColumn: null },
] as const;

// ---------------------------------------------------------------------------
// Field mapping helpers
// ---------------------------------------------------------------------------

/**
 * Transforms a UI row into a DB-safe partial object by applying all
 * custom mappings (e.g. notes → description).
 *
 * Fields with `dbColumn: null` are consumed here and removed from the
 * output. Fields with a `dbColumn` string are renamed.
 * All other fields pass through unchanged.
 */
export function applyFieldMappings(
  row: Record<string, unknown>,
  existingDescription?: string | null,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Build lookup of special mappings
  const columnsByKey = new Map(VARIATION_COLUMNS.map((c) => [c.key, c]));

  for (const [key, value] of Object.entries(row)) {
    const colDef = columnsByKey.get(key);

    if (colDef?.dbColumn === null) {
      // This field has no DB column — handle custom mappings below
      continue;
    }

    const targetKey = colDef?.dbColumn ?? key;
    result[targetKey] = value;
  }

  // --- Custom mappings ---

  // notes → append to description
  const notes = row.notes;
  if (notes && typeof notes === 'string' && notes.trim()) {
    const base = (result.description as string) || existingDescription || '';
    result.description = base
      ? `${base}\n\nObservações: ${notes.trim()}`
      : notes.trim();
  } else if (!result.description && existingDescription) {
    result.description = existingDescription;
  }

  return result;
}
