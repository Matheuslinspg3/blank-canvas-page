/**
 * MINIMAL template — Floating bottom nav, clean white hero with just text,
 * list-style properties (no cards), minimal about, simple contact, ultra-clean footer.
 */
import { useState } from "react";
import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";
import { Building, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStorefrontFilters } from "@/hooks/useStorefrontFilters";
import { StorefrontFilters } from "@/components/storefront/StorefrontFilters";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PropertyCard } from "./TemplateClassic";

interface TemplateProps {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
  properties: StorefrontProperty[];
  primaryColor: string;
}

export function TemplateMinimal({ org, brand, website, properties, primaryColor }: TemplateProps) {
  const { filters, updateFilter, clearFilters, hasActiveFilters, activeFilterCount, filtered, availableCities, availableNeighborhoods } = useStorefrontFilters(properties);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || (!contactForm.email.trim() && !contactForm.phone.trim())) { toast.error("Preencha seu nome e pelo menos e-mail ou telefone."); return; }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("website-lead", {
        body: { organizationId: org.id, name: contactForm.name.trim(), email: contactForm.email.trim() || null, phone: contactForm.phone.trim() || null, message: contactForm.message.trim() || null, source: "website" },
      });
      if (error) throw error;
      toast.success("Mensagem enviada!");
      setContactForm({ name: "", email: "", phone: "", message: "" });
    } catch { toast.error("Erro ao enviar."); } finally { setSending(false); }
  };

  return (
    <>
      {/* ─── TOP LOGO ONLY ─── */}
      <div className="flex items-center justify-center px-6 py-6">
        {brand?.logo_url ? (
          <img src={brand.logo_url} alt={org.name} className="h-8 max-w-[160px] object-contain" />
        ) : (
          <span className="text-lg font-medium text-gray-900">{org.name}</span>
        )}
      </div>

      {/* ─── CLEAN WHITE HERO ─── */}
      <header className="px-6 py-24 md:py-36 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-semibold text-gray-900 mb-5 leading-tight tracking-tight">
            {website?.hero_title || `Bem-vindo à ${org.name}`}
          </h1>
          <p className="text-gray-400 text-base max-w-lg mx-auto leading-relaxed">
            {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
          </p>
        </div>
      </header>

      {/* ─── PROPERTIES: list style (vertical minimal cards) ─── */}
      <section id="imoveis" className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <StorefrontFilters filters={filters} onUpdateFilter={updateFilter} onClearFilters={clearFilters} hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount} availableCities={availableCities} availableNeighborhoods={availableNeighborhoods} primaryColor={primaryColor} />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12"><Building className="h-10 w-10 mx-auto text-gray-200 mb-3" /><p className="text-gray-400 text-sm">Nenhum imóvel encontrado</p></div>
          ) : (
            <div>
              {filtered.map((p) => <PropertyCard key={p.id} property={p} primaryColor={primaryColor} orgSlug={org.slug} variant="minimal" />)}
            </div>
          )}
        </div>
      </section>

      {/* ─── ABOUT: simple text ─── */}
      {website?.about_text && (
        <section id="sobre" className="py-16 px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Sobre</h2>
            <p className="text-gray-500 leading-relaxed whitespace-pre-line text-sm">{website.about_text}</p>
          </div>
        </section>
      )}

      {/* ─── CONTACT: ultra simple ─── */}
      <section id="contato" className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-md mx-auto">
          <h2 className="text-lg font-medium text-gray-900 mb-6 text-center">Contato</h2>
          <form onSubmit={handleContact} className="space-y-3">
            <Input placeholder="Nome *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="border-gray-100 text-sm" />
            <Input placeholder="E-mail ou telefone *" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="border-gray-100 text-sm" />
            <Textarea placeholder="Mensagem" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={3} className="border-gray-100 text-sm" />
            <Button type="submit" disabled={sending} className="w-full gap-2 text-sm" style={{ backgroundColor: primaryColor, color: "white" }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
            </Button>
          </form>
          {(website?.contact_phone || website?.contact_email) && (
            <div className="mt-6 text-center text-xs text-gray-400 space-y-0.5">
              {website.contact_phone && <p>{website.contact_phone}</p>}
              {website.contact_email && <p>{website.contact_email}</p>}
            </div>
          )}
        </div>
      </section>

      {/* ─── FLOATING BOTTOM NAV ─── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <nav className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-full shadow-lg border border-gray-100 bg-white/90 backdrop-blur-sm">
          <a href="#imoveis" className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">Imóveis</a>
          <a href="#sobre" className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">Sobre</a>
          <a href="#contato" className="px-4 py-1.5 text-xs rounded-full text-white" style={{ backgroundColor: primaryColor }}>Contato</a>
        </nav>
      </div>

      {/* ─── FOOTER: just a line ─── */}
      <footer className="py-6 px-6 text-center">
        <p className="text-xs text-gray-300">© {new Date().getFullYear()} {org.name}</p>
      </footer>
    </>
  );
}
