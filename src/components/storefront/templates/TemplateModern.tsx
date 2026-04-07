/**
 * MODERN template — Sticky top navbar with blur, full-screen dark hero with left-aligned text,
 * properties in 2-col horizontal cards, split about (text left + stats right), sticky contact sidebar, footer.
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

export function TemplateModern({ org, brand, website, properties, primaryColor }: TemplateProps) {
  const secondary = brand?.secondary_color || "#1E293B";
  const { filters, updateFilter, clearFilters, hasActiveFilters, activeFilterCount, filtered, availableCities, availableNeighborhoods } = useStorefrontFilters(properties);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || (!contactForm.email.trim() && !contactForm.phone.trim())) {
      toast.error("Preencha seu nome e pelo menos e-mail ou telefone.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("website-lead", {
        body: { organizationId: org.id, name: contactForm.name.trim(), email: contactForm.email.trim() || null, phone: contactForm.phone.trim() || null, message: contactForm.message.trim() || null, source: "website" },
      });
      if (error) throw error;
      toast.success("Mensagem enviada com sucesso!");
      setContactForm({ name: "", email: "", phone: "", message: "" });
    } catch { toast.error("Erro ao enviar mensagem."); } finally { setSending(false); }
  };

  return (
    <>
      {/* ─── STICKY TOP NAV with blur ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-white/10" style={{ backgroundColor: `${secondary}ee` }}>
        <div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
          {brand?.logo_dark_url || brand?.logo_url ? (
            <img src={brand.logo_dark_url || brand.logo_url!} alt={org.name} className="h-8 max-w-[160px] object-contain" />
          ) : (
            <span className="text-lg font-bold text-white">{org.name}</span>
          )}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#imoveis" className="text-white/70 hover:text-white text-sm transition-colors">Imóveis</a>
            <a href="#sobre" className="text-white/70 hover:text-white text-sm transition-colors">Sobre</a>
            <a href="#contato" className="px-4 py-1.5 rounded-full text-sm text-white font-medium transition-transform hover:scale-105" style={{ backgroundColor: primaryColor }}>Contato</a>
          </div>
        </div>
      </nav>

      {/* ─── FULL-SCREEN HERO with left-aligned text ─── */}
      <header className="relative min-h-[80vh] flex items-center" style={{ background: `linear-gradient(160deg, ${secondary} 0%, #0f172a 100%)` }}>
        <div className="relative z-10 px-6 max-w-7xl mx-auto w-full">
          <div className="max-w-2xl">
            <div className="h-1 w-16 rounded-full mb-8" style={{ backgroundColor: primaryColor }} />
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              {website?.hero_title || `Bem-vindo à ${org.name}`}
            </h1>
            <p className="text-lg text-white/60 max-w-xl mb-8">
              {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
            </p>
            <a href="#imoveis" className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-white font-semibold transition-all hover:scale-105 hover:shadow-lg" style={{ backgroundColor: primaryColor }}>
              Explorar imóveis
            </a>
          </div>
        </div>
        {/* Decorative gradient orb */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full opacity-20 blur-3xl" style={{ backgroundColor: primaryColor }} />
      </header>

      {/* ─── PROPERTIES: 2-col horizontal cards ─── */}
      <section id="imoveis" className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold shrink-0">Imóveis Disponíveis</h2>
          </div>
          <div className="mb-8">
            <StorefrontFilters filters={filters} onUpdateFilter={updateFilter} onClearFilters={clearFilters} hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount} availableCities={availableCities} availableNeighborhoods={availableNeighborhoods} primaryColor={primaryColor} />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12"><Building className="h-12 w-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">Nenhum imóvel encontrado</p></div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((p) => <PropertyCard key={p.id} property={p} primaryColor={primaryColor} orgSlug={org.slug} variant="horizontal" />)}
            </div>
          )}
        </div>
      </section>

      {/* ─── ABOUT: split layout (text left + stats right) ─── */}
      {website?.about_text && (
        <section id="sobre" className="py-20 px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-12 items-start">
            <div className="md:col-span-3">
              <h2 className="text-2xl md:text-3xl font-bold mb-6">Sobre a {org.name}</h2>
              <div className="text-gray-600 leading-relaxed whitespace-pre-line">{website.about_text}</div>
            </div>
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div className="rounded-xl p-6 text-center" style={{ backgroundColor: `${primaryColor}10` }}>
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>{properties.length}</p>
                <p className="text-sm text-gray-500 mt-1">Imóveis</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-6 text-center">
                <p className="text-3xl font-bold text-gray-900">{new Set(properties.map(p => p.address_city).filter(Boolean)).size}</p>
                <p className="text-sm text-gray-500 mt-1">Cidades</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-6 text-center col-span-2">
                <p className="text-3xl font-bold text-gray-900">{new Set(properties.map(p => p.address_neighborhood).filter(Boolean)).size}</p>
                <p className="text-sm text-gray-500 mt-1">Bairros atendidos</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── CONTACT: wide form with colored sidebar ─── */}
      <section id="contato" className="py-16 px-6" style={{ backgroundColor: `${primaryColor}08` }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-5 gap-0 rounded-2xl overflow-hidden shadow-lg">
            <div className="md:col-span-2 p-8 text-white flex flex-col justify-center" style={{ backgroundColor: primaryColor }}>
              <h2 className="text-2xl font-bold mb-3">Fale Conosco</h2>
              <p className="text-white/80 text-sm mb-6">Estamos prontos para ajudar você a encontrar o imóvel ideal.</p>
              {website?.contact_phone && <p className="text-sm text-white/90 mb-2">📞 {website.contact_phone}</p>}
              {website?.contact_email && <p className="text-sm text-white/90">✉️ {website.contact_email}</p>}
            </div>
            <form onSubmit={handleContact} className="md:col-span-3 bg-white p-8 space-y-4">
              <Input placeholder="Seu nome *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="border-gray-200" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input placeholder="E-mail" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="border-gray-200" />
                <Input placeholder="Telefone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="border-gray-200" />
              </div>
              <Textarea placeholder="Mensagem (opcional)" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={3} className="border-gray-200" />
              <Button type="submit" disabled={sending} className="w-full text-white gap-2" style={{ backgroundColor: primaryColor }}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-10 px-6" style={{ backgroundColor: secondary }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {brand?.logo_dark_url && <img src={brand.logo_dark_url} alt={org.name} className="h-7 object-contain" />}
            <span className="text-white/50 text-sm">© {new Date().getFullYear()} {org.name}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#imoveis" className="hover:text-white/70 transition-colors">Imóveis</a>
            <a href="#sobre" className="hover:text-white/70 transition-colors">Sobre</a>
            <a href="#contato" className="hover:text-white/70 transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </>
  );
}
