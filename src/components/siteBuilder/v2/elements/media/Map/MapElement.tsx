import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { MapPin } from 'lucide-react';

export function MapElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { address, latitude, longitude, zoom, height } = element.props;
  const h = height || 300;

  if (isEditing) {
    return (
      <ElementWrapper element={element}>
        <div className="w-full bg-muted rounded flex items-center justify-center" style={{ height: h }}>
          <MapPin className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground ml-2">Mapa: {address || `${latitude}, ${longitude}`}</span>
        </div>
      </ElementWrapper>
    );
  }

  const q = address ? encodeURIComponent(address) : `${latitude || -23.55},${longitude || -46.63}`;

  return (
    <ElementWrapper element={element}>
      <iframe
        src={`https://maps.google.com/maps?q=${q}&z=${zoom || 15}&output=embed`}
        className="w-full rounded border-0"
        style={{ height: h }}
        loading="lazy"
        allowFullScreen
      />
    </ElementWrapper>
  );
}
