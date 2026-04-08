import { MessageCircle } from 'lucide-react';
import type { WhatsappCtaABlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: WhatsappCtaABlock; theme: SiteTheme; }

export function WhatsappCtaA({ block, theme }: Props) {
  const { message, buttonLabel, bgColor, textColor } = block.props;
  return (
    <section
      className="py-16 px-4"
      style={{ backgroundColor: bgColor || '#25D366', fontFamily: theme.fontFamily } as React.CSSProperties}
    >
      <div className="max-w-3xl mx-auto text-center">
        <MessageCircle className="w-12 h-12 mx-auto mb-4" style={{ color: textColor || '#ffffff' }} />
        <p className="text-lg md:text-xl mb-6" style={{ color: textColor || '#ffffff' }}>{message}</p>
        <a
          href="#"
          className="inline-block px-8 py-3 rounded-full font-semibold text-lg transition-transform hover:scale-105"
          style={{ backgroundColor: '#ffffff', color: bgColor || '#25D366' }}
        >
          {buttonLabel}
        </a>
      </div>
    </section>
  );
}
