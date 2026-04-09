import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { CSSProperties } from 'react';

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};

export function ButtonElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { label, link, variant, size, fullWidth, openInNewTab } = element.props;
  const s = element.styles;

  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  const v = variant || 'primary';

  // Visual styles applied directly on the button (not the wrapper)
  const btnStyle: CSSProperties = {
    borderRadius: s.borderRadius ?? 6,
    borderWidth: s.borderWidth ?? 0,
    borderColor: s.borderColor || '#e5e7eb',
    borderStyle: (s.borderStyle && s.borderStyle !== 'none') ? s.borderStyle : (s.borderWidth ? 'solid' : undefined),
    boxShadow: SHADOW_MAP[s.boxShadow || 'none'],
  };

  // Storefront uses CSS variables for brand colors
  if (!isEditing) {
    if (v === 'primary') {
      btnStyle.backgroundColor = 'var(--sf-primary, hsl(var(--primary)))';
      btnStyle.color = '#fff';
    } else if (v === 'secondary') {
      btnStyle.backgroundColor = 'var(--sf-secondary, hsl(var(--secondary)))';
      btnStyle.color = '#fff';
    }
  }

  const variantClasses: Record<string, string> = {
    primary: isEditing ? 'bg-primary text-primary-foreground hover:opacity-90' : 'hover:opacity-90',
    secondary: isEditing ? 'bg-secondary text-secondary-foreground hover:opacity-90' : 'hover:opacity-90',
    outline: 'border-2 border-current bg-transparent hover:bg-muted',
    ghost: 'bg-transparent hover:bg-muted',
  };

  const cls = `inline-flex items-center justify-center gap-2 font-medium transition-opacity ${sizeClasses[size || 'md']} ${variantClasses[v] || variantClasses.primary} ${fullWidth ? 'w-full' : ''}`;

  const Tag = isEditing ? 'button' : 'a';
  const extraProps = isEditing
    ? { type: 'button' as const, disabled: true }
    : { href: link || '#', target: openInNewTab ? '_blank' : undefined, rel: openInNewTab ? 'noopener noreferrer' : undefined };

  // Strip visual props from wrapper so they only appear on button
  const wrapperElement: Element = {
    ...element,
    styles: {
      ...element.styles,
      borderRadius: 0,
      borderWidth: 0,
      borderStyle: 'none',
      boxShadow: 'none',
    },
  };

  return (
    <ElementWrapper element={wrapperElement}>
      <Tag className={cls} style={btnStyle} {...(extraProps as any)}>
        {label || 'Botão'}
      </Tag>
    </ElementWrapper>
  );
}
