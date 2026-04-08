import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../ElementWrapper';

export function ButtonElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { label, link, variant, size, fullWidth, icon, openInNewTab } = element.props;

  const sizeClasses: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-3.5 text-lg',
  };

  const variantClasses: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
    outline: 'border-2 border-current bg-transparent hover:bg-muted',
    ghost: 'bg-transparent hover:bg-muted',
  };

  const cls = `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-opacity ${sizeClasses[size || 'md']} ${variantClasses[variant || 'primary']} ${fullWidth ? 'w-full' : ''}`;

  const Tag = isEditing ? 'button' : 'a';
  const extraProps = isEditing
    ? { type: 'button' as const, disabled: true }
    : { href: link || '#', target: openInNewTab ? '_blank' : undefined, rel: openInNewTab ? 'noopener noreferrer' : undefined };

  return (
    <ElementWrapper element={element}>
      <Tag className={cls} {...(extraProps as any)}>
        {label || 'Botão'}
      </Tag>
    </ElementWrapper>
  );
}
