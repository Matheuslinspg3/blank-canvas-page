/**
 * Whitelist of valid columns on the `properties` table.
 * Keeps inserts safe by stripping unknown keys before they hit Supabase.
 */
const VALID_PROPERTY_COLUMNS = new Set([
  'id', 'organization_id', 'created_by', 'property_type_id', 'title',
  'description', 'transaction_type', 'sale_price', 'rent_price',
  'condominium_fee', 'iptu', 'status', 'bedrooms', 'suites', 'bathrooms',
  'parking_spots', 'area_total', 'area_built', 'floor', 'address_street',
  'address_number', 'address_complement', 'address_neighborhood',
  'address_city', 'address_state', 'address_zipcode', 'latitude',
  'longitude', 'amenities', 'featured', 'created_at', 'updated_at',
  'iptu_monthly', 'commission_value', 'commission_type', 'inspection_fee',
  'launch_stage', 'development_name', 'property_condition',
  'beach_distance_meters', 'captador_id', 'source_provider',
  'source_property_id', 'source_key_id', 'source_code', 'source_status',
  'raw_payload', 'import_status', 'import_warnings', 'description_generated',
  'imobzi_updated_at', 'payment_options', 'property_code', 'area_useful',
  'sale_price_financed', 'youtube_url', 'geocode_status', 'geocode_precision',
  'geocoded_at', 'geocode_provider', 'geocode_hash', 'geocode_error',
  'availability_status', 'availability_status_updated_at', 'ai_blacklist',
  'building_id', 'marketplace_contact_phone', 'cover_image_url',
  'property_group_id',
]);

export interface ColumnValidationResult {
  /** Cleaned data with only valid columns */
  clean: Record<string, unknown>;
  /** Column names that were stripped */
  invalidColumns: string[];
}

/**
 * Strips keys that don't exist on the `properties` table.
 * Returns the cleaned object and a list of removed column names.
 */
export function sanitizePropertyInsert(
  data: Record<string, unknown>,
): ColumnValidationResult {
  const clean: Record<string, unknown> = {};
  const invalidColumns: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (VALID_PROPERTY_COLUMNS.has(key)) {
      clean[key] = value;
    } else {
      invalidColumns.push(key);
    }
  }

  return { clean, invalidColumns };
}
