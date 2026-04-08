

# Plan: FASE H1 — Seed de dados realistas para 3 orgs de teste

## Summary

Insert realistic test data for 3 new organizations with varying content levels, then run each through the full migration pipeline to validate visual quality.

## Data Insertion Strategy

All data goes via SQL INSERT statements (using the insert tool) into existing tables. No schema changes needed.

### Org 1 — "Vitrine Premium Imóveis" (alto padrão)
- **Template**: `elegant`
- **Brand**: dark navy (#0F172A) + gold (#D4AF37) + accent (#E11D48), font Playfair Display
- **Website**: rich hero ("Imóveis de alto padrão no litoral paulista"), detailed about text, all contact fields, meta title/description
- **Properties**: 12 properties — mix of luxury apartments, penthouses, beachfront houses in Guarujá/Santos/Riviera. Prices R$800k–R$5M. Real Unsplash images. 4 featured.

### Org 2 — "Nova Casa Imobiliária" (médio padrão)
- **Template**: `modern`
- **Brand**: blue (#2563EB) + dark (#1E293B) + orange (#F97316), font Inter
- **Website**: hero filled, about partially filled, no meta_description, whatsapp but no email
- **Properties**: 6 properties — apartments and houses in Campinas/Jundiaí. Prices R$280k–R$750k. 2 featured.

### Org 3 — "JR Corretor" (edge case)
- **Template**: `classic`
- **Brand**: defaults only (generic blue), no logo, no slogan
- **Website**: hero_title only, no about, no meta, no whatsapp
- **Properties**: 2 properties — basic apartments in Sorocaba. Minimal descriptions.

## Data Tables Affected

| Table | Rows per Org |
|-------|-------------|
| `organizations` | 1 |
| `website_settings` | 1 |
| `brand_settings` | 1 |
| `marketplace_properties` | 12 / 6 / 2 |

Total: ~26 new rows across 4 tables.

## Property Images

Use curated Unsplash real estate photos (`https://images.unsplash.com/photo-{id}?w=800`) — different photo per property for realism.

## Validation Pipeline

After seeding, for each org:
1. Navigate to `/dev/migrate-site-v2?orgId=...`
2. Generate v2 preview from legacy
3. Save as `draft_v2`
4. Publish to `published_v2`
5. Activate `advanced` mode
6. Navigate to `/dev/storefront-v2?orgId=...`
7. Screenshot and evaluate visual quality (hero, spacing, grid, CTA)

## Conversion Quality Assessment

Evaluate per org:
- Hero convincingness (title, subtitle, CTA button)
- About section rendering
- Property grid layout and card quality
- Contact/CTA section completeness
- Overall "does this look like a real site?"

If patterns of visual issues emerge, apply targeted fixes to `convertLegacyToSiteLayoutV2.ts` (preset adjustments, spacing, fallback text).

## Files

| File | Action |
|------|--------|
| No file changes for seeding | Data via INSERT tool |
| `src/lib/convertLegacyToSiteLayoutV2.ts` | Update only if conversion issues found |

## Deliverables

- Table with org name, type, template, visual quality rating, issues
- Screenshots of each org on `/dev/storefront-v2`
- Any converter fixes applied

