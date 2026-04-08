import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { MessageCircle } from 'lucide-react';

export function WhatsAppButtonElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { label, phoneNumber, message, size, showIcon } = element.props;

  const sizeClasses: Record<string, string> = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const href = phoneNumber
    ? `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message || '')}`
    : '#';

  const Tag = isEditing ? 'button' : 'a';
  const props = isEditing ? { type: 'button' as const, disabled: true } : { href, target: '_blank', rel: 'noopener noreferrer' };

  return (
    <ElementWrapper element={element}>
      <Tag
        className={`inline-flex items-center gap-2 rounded-lg font-medium text-white ${sizeClasses[size || 'md']}`}
        style={{ backgroundColor: '#25D366' }}
        {...(props as any)}
      >
        {showIcon !== false && <MessageCircle className="w-5 h-5" />}
        {label || 'Fale pelo WhatsApp'}
      </Tag>
    </ElementWrapper>
  );
}
