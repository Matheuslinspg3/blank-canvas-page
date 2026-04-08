import type { AboutBBlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: AboutBBlock; theme: SiteTheme; }

export function AboutB({ block, theme }: Props) {
  const { title, text, bgColor, textColor } = block.props;
  return (
    <section
      className="py-20 px-4"
      style={{ backgroundColor: bgColor || '#f3f4f6', fontFamily: theme.fontFamily } as React.CSSProperties}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-2xl md:text-4xl font-bold mb-6" style={{ color: textColor || theme.primaryColor }}>{title}</h2>
          <p className="text-base md:text-lg leading-relaxed whitespace-pre-line" style={{ color: textColor || '#374151' }}>{text}</p>
        </div>
        <div className="aspect-square rounded-2xl overflow-hidden" style={{ backgroundColor: theme.secondaryColor }}>
          <div className="w-full h-full flex items-center justify-center text-white/50 text-sm">Imagem da empresa</div>
        </div>
      </div>
    </section>
  );
}
