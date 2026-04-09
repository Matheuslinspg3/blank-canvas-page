import { registerSectionTemplate } from '../registry';
import { section, row, col, placeholderThumb } from '../helpers';

registerSectionTemplate({
  id: 'custom-blank',
  label: 'Seção em branco',
  category: 'custom',
  thumbnail: placeholderThumb('custom', 'Em Branco'),
  description: 'Seção vazia para montar livremente com qualquer elemento.',
  build: () =>
    section(
      [row([col(12, [], { paddingTop: 24, paddingRight: 16, paddingBottom: 24, paddingLeft: 16 })])],
      { paddingTop: 32, paddingBottom: 32, minHeight: 200 },
      'Personalizado',
    ),
});
