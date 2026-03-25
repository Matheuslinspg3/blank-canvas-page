import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import type { StorefrontOrg, StorefrontWebsite } from "@/hooks/useStorefront";

interface Props {
  org: StorefrontOrg;
  website: StorefrontWebsite | null;
  primaryColor: string;
}

export function StorefrontContact({ org, website, primaryColor }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      toast.error("Preencha seu nome e pelo menos e-mail ou telefone.");
      return;
    }

    setSending(true);
    try {
      // Insert into leads table via edge function for proper org association
      const { error } = await supabase.functions.invoke("website-lead", {
        body: {
          organizationId: org.id,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          message: message.trim() || null,
          source: "website",
        },
      });
      if (error) throw error;

      toast.success("Mensagem enviada com sucesso! Entraremos em contato.");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="contato" className="py-16 px-6 bg-gray-50">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Entre em Contato</h2>
        <p className="text-gray-500 text-center mb-8">
          Preencha o formulário e nossa equipe entrará em contato
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div>
            <Input placeholder="Seu nome *" value={name} onChange={(e) => setName(e.target.value)} required className="border-gray-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-gray-200" />
            <Input placeholder="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} className="border-gray-200" />
          </div>
          <Textarea placeholder="Mensagem (opcional)" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="border-gray-200" />
          <Button
            type="submit"
            disabled={sending}
            className="w-full text-white gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Mensagem
          </Button>
        </form>

        {(website?.contact_phone || website?.contact_email) && (
          <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
            {website.contact_phone && <p>📞 {website.contact_phone}</p>}
            {website.contact_email && <p>✉️ {website.contact_email}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
