import { registerElement, ZERO_PADDING_STYLES } from '../../../elementRegistry';
import { Play } from 'lucide-react';
import { VideoElement } from './VideoElement';
import { VideoInspector } from './VideoInspector';

registerElement({
  type: 'video',
  label: 'Vídeo',
  category: 'media',
  icon: Play,
  defaultProps: { source: 'youtube', url: '', autoplay: false, controls: true, loop: false, muted: false, aspectRatio: '16:9' },
  defaultStyles: { ...ZERO_PADDING_STYLES },
  Component: VideoElement,
  Inspector: VideoInspector,
});
