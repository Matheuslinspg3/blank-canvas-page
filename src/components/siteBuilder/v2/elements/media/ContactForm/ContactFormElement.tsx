import { useState } from 'react';
import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function ContactFormElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { heading, fields, submitLabel } = element.props;
  const f = fields || { name: true, email: true, phone: true, message: true };

  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    if (!form.name && !form.email && !form.phone) {
      toast.error('Preencha pelo menos nome, e-mail ou telefone.');
      return;
    }

    setSending(true);
    try {
      // Try to detect org from the current hostname and create a lead
      const hostname = window.location.hostname;
      const { data: domainData } = await supabase
        .from('tenant_domains')
        .select('organization_id')
        .eq('hostname', hostname)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      let orgId = domainData?.organization_id;

      // Fallback: try subdomain pattern
      if (!orgId) {
        const match = hostname.match(/^([^.]+)\.portadocorretor\.com\.br$/);
        if (match) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', match[1])
            .maybeSingle();
          orgId = orgData?.id;
        }
      }

      if (orgId) {
        // Use edge function to create lead as anonymous visitor
        await supabase.functions.invoke('create-site-lead', {
          body: {
            organization_id: orgId,
            name: form.name || 'Visitante do site',
            email: form.email || null,
            phone: form.phone || null,
            message: form.message || null,
          },
        });
      }

      setSent(true);
      toast.success('Mensagem enviada com sucesso!');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <ElementWrapper element={element}>
        <div className="text-center py-8">
          <p className="text-lg font-medium text-green-600">✅ Mensagem enviada!</p>
          <p className="text-sm text-muted-foreground mt-1">Entraremos em contato em breve.</p>
          <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>
            Enviar outra mensagem
          </Button>
        </div>
      </ElementWrapper>
    );
  }

  return (
    <ElementWrapper element={element}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {heading && <h3 className="text-lg font-semibold">{heading}</h3>}
        {f.name && (
          <Input
            placeholder="Nome"
            disabled={isEditing || sending}
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
        )}
        {f.email && (
          <Input
            placeholder="E-mail"
            type="email"
            disabled={isEditing || sending}
            value={form.email}
            onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
          />
        )}
        {f.phone && (
          <Input
            placeholder="Telefone"
            disabled={isEditing || sending}
            value={form.phone}
            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
          />
        )}
        {f.message && (
          <Textarea
            placeholder="Mensagem"
            disabled={isEditing || sending}
            value={form.message}
            onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
          />
        )}
        <Button type="submit" disabled={isEditing || sending} className="w-full">
          {sending ? 'Enviando...' : (submitLabel || 'Enviar')}
        </Button>
      </form>
    </ElementWrapper>
  );
}
