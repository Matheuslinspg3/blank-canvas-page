import type { FooterBBlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: FooterBBlock; theme: SiteTheme; }

export function FooterB({ block, theme }: Props) {
  const { showSocial, bgColor, textColor } = block.props;
  const tc = textColor || '#9ca3af';
  return (
    <footer
      className="py-6 px-4"
      style={{ backgroundColor: bgColor || '#1f2937', fontFamily: theme.fontFamily } as React.CSSProperties}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm" style={{ color: tc }}>© {new Date().getFullYear()} Imobiliária — Todos os direitos reservados</p>
        {showSocial && <p className="text-sm" style={{ color: tc }}>Instagram · Facebook · LinkedIn</p>}
      </div>
    </footer>
  );
}
