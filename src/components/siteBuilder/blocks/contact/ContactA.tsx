import { Mail, Phone, MapPin } from 'lucide-react';
import type { ContactABlock, SiteTheme } from '@/types/siteBuilder';

interface Props { block: ContactABlock; theme: SiteTheme; }

export function ContactA({ block, theme }: Props) {
  const { title, subtitle, showForm } = block.props;
  return (
    <section className="py-16 px-4" style={{ fontFamily: theme.fontFamily } as React.CSSProperties}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold mb-3" style={{ color: theme.primaryColor }}>{title}</h2>
          {subtitle && <p className="text-base md:text-lg text-gray-600">{subtitle}</p>}
        </div>
        <div className={`grid grid-cols-1 ${showForm ? 'md:grid-cols-2' : ''} gap-12`}>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Phone className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: theme.primaryColor }} />
              <div><p className="font-semibold">Telefone</p><p className="text-gray-600">(11) 99999-9999</p></div>
            </div>
            <div className="flex items-start gap-4">
              <Mail className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: theme.primaryColor }} />
              <div><p className="font-semibold">E-mail</p><p className="text-gray-600">contato@imobiliaria.com</p></div>
            </div>
            <div className="flex items-start gap-4">
              <MapPin className="w-5 h-5 mt-1 flex-shrink-0" style={{ color: theme.primaryColor }} />
              <div><p className="font-semibold">Endereço</p><p className="text-gray-600">Rua Exemplo, 123</p></div>
            </div>
          </div>
          {showForm && (
            <div className="space-y-4">
              <input className="w-full border rounded-lg px-4 py-3" placeholder="Seu nome" />
              <input className="w-full border rounded-lg px-4 py-3" placeholder="Seu e-mail" />
              <textarea className="w-full border rounded-lg px-4 py-3" rows={4} placeholder="Mensagem" />
              <button className="px-6 py-3 rounded-lg font-semibold text-white" style={{ backgroundColor: theme.primaryColor }}>Enviar</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
