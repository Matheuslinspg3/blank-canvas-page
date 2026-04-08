import type { AboutABlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: AboutABlock; theme: SiteTheme; }

export function AboutA({ block, theme }: Props) {
  const { title, text } = block.props;
  return (
    <section className="py-20 px-4" style={{ fontFamily: theme.fontFamily } as React.CSSProperties}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-4xl font-bold mb-6" style={{ color: theme.primaryColor }}>{title}</h2>
        <p className="text-base md:text-lg leading-relaxed text-gray-600 whitespace-pre-line">{text}</p>
      </div>
    </section>
  );
}
