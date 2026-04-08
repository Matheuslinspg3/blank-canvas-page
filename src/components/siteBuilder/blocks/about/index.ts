import { FileText, LayoutPanelLeft } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { AboutA } from './AboutA';
import { AboutAInspector } from './AboutAInspector';
import { AboutB } from './AboutB';
import { AboutBInspector } from './AboutBInspector';

BlockRegistry.about.A = {
  label: 'Sobre — Texto centralizado',
  icon: FileText,
  defaultProps: { title: 'Sobre nós', text: 'Somos uma imobiliária comprometida com a qualidade...', image: '', imagePosition: 'right' as const },
  Component: AboutA as any,
  Inspector: AboutAInspector as any,
};

BlockRegistry.about.B = {
  label: 'Sobre — Com imagem lateral',
  icon: LayoutPanelLeft,
  defaultProps: { title: 'Nossa história', text: 'Com anos de experiência no mercado imobiliário...', bgColor: '#f3f4f6', textColor: '#374151' },
  Component: AboutB as any,
  Inspector: AboutBInspector as any,
};
