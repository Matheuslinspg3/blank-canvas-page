import { registerElement, ZERO_PADDING_STYLES } from '../../../elementRegistry';
import { MapPin } from 'lucide-react';
import { MapElement } from './MapElement';
import { MapInspector } from './MapInspector';

registerElement({
  type: 'map',
  label: 'Mapa',
  category: 'media',
  icon: MapPin,
  defaultProps: { address: '', latitude: -23.55, longitude: -46.63, zoom: 15, height: 300, showMarker: true },
  defaultStyles: { ...ZERO_PADDING_STYLES },
  Component: MapElement,
  Inspector: MapInspector,
});
