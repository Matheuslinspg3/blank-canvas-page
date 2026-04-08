import { PanelBottom, Minus } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { FooterA } from './FooterA';
import { FooterAInspector } from './FooterAInspector';
import { FooterB } from './FooterB';
import { FooterBInspector } from './FooterBInspector';

BlockRegistry.footer.A = {
  label: 'Footer — 3 colunas',
  icon: PanelBottom,
  defaultProps: { showSocial: true, showCredits: true, bgColor: '#111827', textColor: '#d1d5db' },
  Component: FooterA as any,
  Inspector: FooterAInspector as any,
};

BlockRegistry.footer.B = {
  label: 'Footer — Minimal',
  icon: Minus,
  defaultProps: { columns: 1, showSocial: true, showNewsletter: false, bgColor: '#1f2937', textColor: '#9ca3af' },
  Component: FooterB as any,
  Inspector: FooterBInspector as any,
};
