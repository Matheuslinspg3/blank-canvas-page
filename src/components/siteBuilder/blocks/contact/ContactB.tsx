import { Phone, Mail, MapPin } from 'lucide-react';
import type { ContactBBlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: ContactBBlock; theme: SiteTheme; }

export function ContactB({ block, theme }: Props) {
  const { title, subtitle, bgColor, layout } = block.props;
  const isStacked = layout === 'stacked';
  return (
    <section
      className="py-16 px-4"
      style={{ backgroundColor: bgColor || '#ffffff', fontFamily: theme.fontFamily } as React.CSSProperties}
    >
      <div className="max-w-4xl mx-auto text-center mb-10">
        <h2 className="text-2xl md:text-4xl font-bold mb-3" style={{ color: theme.primaryColor }}>{title}</h2>
        {subtitle && <p className="text-base md:text-lg text-gray-600">{subtitle}</p>}
      </div>
      <div className={`max-w-4xl mx-auto ${isStacked ? 'space-y-6' : 'grid grid-cols-1 md:grid-cols-3 gap-8'}`}>
        <div className="flex items-center gap-3 justify-center">
          <Phone className="w-5 h-5" style={{ color: theme.primaryColor }} />
          <span className="text-gray-700">(11) 99999-9999</span>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <Mail className="w-5 h-5" style={{ color: theme.primaryColor }} />
          <span className="text-gray-700">contato@imobiliaria.com</span>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <MapPin className="w-5 h-5" style={{ color: theme.primaryColor }} />
          <span className="text-gray-700">Rua Exemplo, 123</span>
        </div>
      </div>
    </section>
  );
}
