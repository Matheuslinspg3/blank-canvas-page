import type { SiteLayoutV2 } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';
import '@/components/siteBuilder/v2/elements'; // register all element types
import { SectionRenderer } from '@/components/siteBuilder/v2/SectionRenderer';
import { PropertyListProvider } from '@/components/siteBuilder/v2/elements/properties/PropertyList/PropertyListContext';

interface Props {
  siteLayout: SiteLayoutV2;
  properties: any[];
}

export function SiteDocumentRendererV2({ siteLayout, properties }: Props) {
  const sortedSections = [...siteLayout.sections]
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <PropertyListProvider value={properties}>
      <div style={{ fontFamily: siteLayout.theme.fontFamily || undefined }}>
        {sortedSections.map(section => (
          <SectionRenderer
            key={section.id}
            section={section}
            theme={siteLayout.theme}
            properties={properties}
            isEditing={false}
          />
        ))}
      </div>
    </PropertyListProvider>
  );
}
