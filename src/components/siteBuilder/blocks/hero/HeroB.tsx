import type { HeroBBlock, SiteTheme } from '@/types/siteBuilder';

interface Props {
  block: HeroBBlock;
  theme: SiteTheme;
}

export function HeroB({ block, theme }: Props) {
  const { title, subtitle, image, ctaLabel, ctaHref, bgColor, textColor } = block.props;

  return (
    <section
      className="grid grid-cols-1 md:grid-cols-2 min-h-[60vh]"
      style={{ fontFamily: theme.fontFamily } as React.CSSProperties}
    >
      {/* Left: text */}
      <div
        className="flex flex-col justify-center px-8 md:px-16 py-16"
        style={{ backgroundColor: bgColor || '#f9fafb' }}
      >
        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight"
          style={{ color: textColor || '#111827' }}
        >
          {title}
        </h1>
        <p
          className="text-base md:text-lg mb-8 opacity-80"
          style={{ color: textColor || '#374151' }}
        >
          {subtitle}
        </p>
        {ctaLabel && (
          <a
            href={ctaHref || '#'}
            className="self-start inline-block px-8 py-3 rounded-lg font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
      {/* Right: image */}
      <div className="relative min-h-[300px] md:min-h-0">
        {image ? (
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: theme.secondaryColor }} />
        )}
      </div>
    </section>
  );
}
