import type { SiteLayoutV2 } from '@/types/siteBuilderV2';
import type { PropertySummary } from '@/types/siteBuilder';

interface Props {
  siteLayout: SiteLayoutV2;
  properties: PropertySummary[];
}

export function SiteDocumentRendererV2({ siteLayout, properties }: Props) {
  return <div>Renderer v2 — em construção (FASE F)</div>;
}
