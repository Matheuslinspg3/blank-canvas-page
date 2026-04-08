import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Code } from 'lucide-react';
import { EmbedHtmlElement } from './EmbedHtmlElement';
import { EmbedHtmlInspector } from './EmbedHtmlInspector';

registerElement({
  type: 'embed_html',
  label: 'HTML Embed',
  category: 'advanced',
  icon: Code,
  defaultProps: { html: '', height: undefined },
  defaultStyles: { ...DEFAULT_STYLES, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
  Component: EmbedHtmlElement,
  Inspector: EmbedHtmlInspector,
});
