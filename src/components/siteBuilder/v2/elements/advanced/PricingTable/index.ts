import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { CreditCard } from 'lucide-react';
import { PricingTableElement } from './PricingTableElement';
import { PricingTableInspector } from './PricingTableInspector';

registerElement({
  type: 'pricing_table',
  label: 'Tabela de Preços',
  category: 'advanced',
  icon: CreditCard,
  defaultProps: { plans: [{ name: 'Básico', price: 99, period: 'mês', features: ['10 Imóveis', 'Suporte email'], ctaLabel: 'Contratar', ctaLink: '#', highlighted: false }, { name: 'Pro', price: 199, period: 'mês', features: ['50 Imóveis', 'Suporte prioritário', 'Site personalizado'], ctaLabel: 'Contratar', ctaLink: '#', highlighted: true }], currency: 'R$' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: PricingTableElement,
  Inspector: PricingTableInspector,
});
