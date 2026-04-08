import '@/components/siteBuilder/blocks'; // registers all blocks
import { BlockRegistry } from '@/components/siteBuilder/blockRegistry';
import type { SiteTheme, PropertySummary, Block } from '@/types/siteBuilder';

const DEMO_THEME: SiteTheme = {
  primaryColor: '#D62828',
  secondaryColor: '#1E3A5F',
  accentColor: '#F77F00',
  fontFamily: 'Inter, sans-serif',
};

const DEMO_PROPERTIES: PropertySummary[] = [
  { id: '1', title: 'Apartamento Centro', description: '', sale_price: 450000, rent_price: null, transaction_type: 'sale', images: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600'], bedrooms: 3, bathrooms: 2, parking_spots: 1, area_total: 85, area_built: 75, address_city: 'São Paulo', address_neighborhood: 'Centro', address_state: 'SP', is_featured: true, organization_id: null, status: 'active' },
  { id: '2', title: 'Casa Jardins', description: '', sale_price: 980000, rent_price: null, transaction_type: 'sale', images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600'], bedrooms: 4, bathrooms: 3, parking_spots: 2, area_total: 200, area_built: 160, address_city: 'São Paulo', address_neighborhood: 'Jardins', address_state: 'SP', is_featured: true, organization_id: null, status: 'active' },
  { id: '3', title: 'Studio Pinheiros', description: '', sale_price: null, rent_price: 2800, transaction_type: 'rent', images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600'], bedrooms: 1, bathrooms: 1, parking_spots: 0, area_total: 35, area_built: 30, address_city: 'São Paulo', address_neighborhood: 'Pinheiros', address_state: 'SP', is_featured: false, organization_id: null, status: 'active' },
  { id: '4', title: 'Cobertura Vila Madalena', description: '', sale_price: 1250000, rent_price: null, transaction_type: 'sale', images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600'], bedrooms: 3, bathrooms: 2, parking_spots: 2, area_total: 150, area_built: 130, address_city: 'São Paulo', address_neighborhood: 'Vila Madalena', address_state: 'SP', is_featured: true, organization_id: null, status: 'active' },
  { id: '5', title: 'Apartamento Moema', description: '', sale_price: 620000, rent_price: null, transaction_type: 'sale', images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600'], bedrooms: 2, bathrooms: 1, parking_spots: 1, area_total: 70, area_built: 60, address_city: 'São Paulo', address_neighborhood: 'Moema', address_state: 'SP', is_featured: false, organization_id: null, status: 'active' },
  { id: '6', title: 'Casa Alphaville', description: '', sale_price: 1800000, rent_price: null, transaction_type: 'sale', images: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600'], bedrooms: 5, bathrooms: 4, parking_spots: 3, area_total: 350, area_built: 280, address_city: 'Barueri', address_neighborhood: 'Alphaville', address_state: 'SP', is_featured: true, organization_id: null, status: 'active' },
];

// Build demo blocks for each registered variant
function buildDemoBlocks(): { block: Block; def: any }[] {
  const results: { block: Block; def: any }[] = [];
  let order = 0;

  for (const [type, variants] of Object.entries(BlockRegistry)) {
    for (const [variant, def] of Object.entries(variants)) {
      if (!def) continue;
      results.push({
        block: {
          id: `demo-${type}-${variant}`,
          type,
          variant,
          visible: true,
          order: order++,
          props: def.defaultProps,
        } as Block,
        def,
      });
    }
  }
  return results;
}

export default function DevBlocks() {
  const demos = buildDemoBlocks();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-50">
        <h1 className="text-xl font-bold">Site Builder — Block Preview (DEV)</h1>
        <p className="text-sm text-gray-500">{demos.length} blocos registrados</p>
      </header>

      {demos.map(({ block, def }) => {
        const Component = def.Component;
        const isPropertyBlock = ['property_grid', 'property_carousel'].includes(block.type);

        return (
          <div key={block.id} className="mb-2">
            <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm font-mono">
              <span className="font-bold">{block.type}.{block.variant}</span>
              <span className="ml-3 text-gray-500">{def.label}</span>
            </div>
            <Component
              block={block}
              theme={DEMO_THEME}
              {...(isPropertyBlock ? { properties: DEMO_PROPERTIES } : {})}
            />
          </div>
        );
      })}
    </div>
  );
}
