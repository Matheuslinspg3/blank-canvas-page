import { Image, Columns2 } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { HeroA } from './HeroA';
import { HeroAInspector } from './HeroAInspector';
import { HeroB } from './HeroB';
import { HeroBInspector } from './HeroBInspector';

BlockRegistry.hero.A = {
  label: 'Hero — Imagem de fundo',
  icon: Image,
  defaultProps: {
    title: 'Encontre o imóvel dos seus sonhos',
    subtitle: 'As melhores opções da região com atendimento personalizado.',
    bgImage: '',
    ctaLabel: 'Ver imóveis',
    ctaHref: '#imoveis',
    bgColor: '#1E3A5F',
    textColor: '#ffffff',
  },
  Component: HeroA as any,
  Inspector: HeroAInspector as any,
};

BlockRegistry.hero.B = {
  label: 'Hero — Split horizontal',
  icon: Columns2,
  defaultProps: {
    title: 'Seu novo lar está aqui',
    subtitle: 'Conheça nosso portfólio completo de imóveis.',
    image: '',
    ctaLabel: 'Explorar',
    ctaHref: '#imoveis',
    bgColor: '#f9fafb',
    textColor: '#111827',
  },
  Component: HeroB as any,
  Inspector: HeroBInspector as any,
};
