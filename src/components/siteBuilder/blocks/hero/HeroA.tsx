import type { HeroABlock, SiteTheme } from '@/types/siteBuilder';

interface Props {
  block: HeroABlock;
  theme: SiteTheme;
}

export function HeroA({ block, theme }: Props) {
  const { title, subtitle, bgImage, ctaLabel, ctaHref, bgColor, textColor } = block.props;

  return (
    <section
      className="relative min-h-[70vh] flex items-center justify-center text-center"
      style={{
        '--block-primary': theme.primaryColor,
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundColor: bgColor || theme.primaryColor,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: theme.fontFamily,
      } as React.CSSProperties}
    >
      {bgImage && (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-20">
        <h1
          className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
          style={{ color: textColor || '#ffffff' }}
        >
          {title}
        </h1>
        <p
          className="text-lg md:text-xl mb-8 opacity-90"
          style={{ color: textColor || '#ffffff' }}
        >
          {subtitle}
        </p>
        {ctaLabel && (
          <a
            href={ctaHref || '#'}
            className="inline-block px-8 py-3 rounded-lg text-lg font-semibold transition-transform hover:scale-105"
            style={{
              backgroundColor: theme.accentColor,
              color: '#ffffff',
            }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}
