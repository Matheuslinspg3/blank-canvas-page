import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Play } from 'lucide-react';

function getEmbedUrl(source: string, url: string): string | null {
  if (!url) return null;
  if (source === 'youtube') {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?\s]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  }
  if (source === 'vimeo') {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }
  return url;
}

export function VideoElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { source, url, autoplay, controls, loop, muted, aspectRatio } = element.props;
  const embedUrl = getEmbedUrl(source || 'youtube', url || '');

  const ratioMap: Record<string, string> = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%', '21:9': '42.85%' };
  const paddingBottom = ratioMap[aspectRatio || '16:9'] || '56.25%';

  if (!embedUrl) {
    return (
      <ElementWrapper element={element}>
        <div className="w-full bg-muted rounded flex items-center justify-center" style={{ paddingBottom, position: 'relative' }}>
          <Play className="w-12 h-12 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </ElementWrapper>
    );
  }

  const params = new URLSearchParams();
  if (autoplay) params.set('autoplay', '1');
  if (!controls) params.set('controls', '0');
  if (loop) params.set('loop', '1');
  if (muted) params.set('mute', '1');
  const fullUrl = `${embedUrl}${params.toString() ? '?' + params.toString() : ''}`;

  return (
    <ElementWrapper element={element}>
      <div className="relative w-full" style={{ paddingBottom }}>
        {isEditing ? (
          <div className="absolute inset-0 bg-muted rounded flex items-center justify-center">
            <Play className="w-12 h-12 text-muted-foreground" />
            <p className="text-xs text-muted-foreground ml-2">Vídeo (preview desabilitado)</p>
          </div>
        ) : (
          <iframe
            src={fullUrl}
            className="absolute inset-0 w-full h-full rounded"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    </ElementWrapper>
  );
}
