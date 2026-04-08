import type { FooterABlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: FooterABlock; theme: SiteTheme; }

export function FooterA({ block, theme }: Props) {
  const { showSocial, showCredits, bgColor, textColor } = block.props;
  const tc = textColor || '#d1d5db';
  return (
    <footer className="py-12 px-4" style={{ backgroundColor: bgColor || '#111827', fontFamily: theme.fontFamily } as React.CSSProperties}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-bold text-lg mb-3" style={{ color: '#ffffff' }}>Imobiliária</h3>
          <p className="text-sm leading-relaxed" style={{ color: tc }}>Encontre o imóvel ideal com quem entende do mercado.</p>
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3" style={{ color: '#ffffff' }}>Links</h3>
          <ul className="space-y-2 text-sm" style={{ color: tc }}>
            <li>Imóveis</li><li>Sobre</li><li>Contato</li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold text-lg mb-3" style={{ color: '#ffffff' }}>Contato</h3>
          <p className="text-sm" style={{ color: tc }}>(11) 99999-9999</p>
          <p className="text-sm" style={{ color: tc }}>contato@imobiliaria.com</p>
          {showSocial && <div className="flex gap-3 mt-4"><span className="text-sm" style={{ color: tc }}>Instagram · Facebook</span></div>}
        </div>
      </div>
      {showCredits && (
        <div className="mt-8 pt-6 border-t border-white/10 text-center text-xs" style={{ color: tc }}>
          © {new Date().getFullYear()} — Todos os direitos reservados
        </div>
      )}
    </footer>
  );
}
