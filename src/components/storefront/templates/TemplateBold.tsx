/**
 * BOLD template — No traditional nav (floating pill nav at bottom), massive hero with geometric bg,
 * large 2-col card grid, bold full-width about, contact with colored bg, compact footer.
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

export function TemplateBold({ org, brand, website, properties, primaryColor }: TemplateProps) {
  const secondary = brand?.secondary_color || "#1E293B";
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
      {/* ─── MASSIVE HERO with geometric shapes, logo top-left ─── */}
      <header className="relative overflow-hidden min-h-[85vh] flex flex-col" style={{ backgroundColor: primaryColor }}>
        <div className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
          {brand?.logo_dark_url || brand?.logo_url ? (
            <img src={brand.logo_dark_url || brand.logo_url!} alt={org.name} className="h-10 max-w-[180px] object-contain" />
          ) : (
            <span className="text-xl font-extrabold text-white tracking-tight">{org.name}</span>
          )}
        </div>
        <div className="relative z-10 flex-1 flex items-center px-6 max-w-7xl mx-auto w-full">
          <div>
            <h1 className="text-5xl md:text-8xl font-black text-white leading-none uppercase tracking-tighter max-w-4xl">
              {website?.hero_title || `Bem-vindo à ${org.name}`}
            </h1>
            <p className="text-lg md:text-2xl text-white/70 mt-6 max-w-2xl font-medium">
              {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
            </p>
            <a href="#imoveis" className="inline-block mt-10 px-10 py-4 bg-white font-bold text-sm uppercase tracking-wider rounded-none transition-transform hover:scale-105" style={{ color: primaryColor }}>
              Ver Imóveis →
            </a>
          </div>
        </div>
        {/* Geometric shapes */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rotate-45 translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 left-1/2 w-[400px] h-[400px] bg-white/5 -rotate-12 translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-white/10 rotate-45 translate-x-1/4 translate-y-1/4" />
      </header>

      {/* ─── FLOATING PILL NAV ─── */}
      <div className="sticky top-4 z-50 flex justify-center pointer-events-none">
        <nav className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full shadow-lg border border-gray-200 bg-white pointer-events-auto">
          <a href="#imoveis" className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-colors">Imóveis</a>
          <a href="#sobre" className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-colors">Sobre</a>
          <a href="#contato" className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full text-white transition-transform hover:scale-105" style={{ backgroundColor: primaryColor }}>Contato</a>
        </nav>
      </div>

      {/* ─── PROPERTIES: big 2-col cards with colored left border ─── */}
      <section id="imoveis" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">Imóveis</h2>
          <div className="h-1.5 w-20 rounded-full mb-8" style={{ backgroundColor: primaryColor }} />
          <div className="mb-8">
            <StorefrontFilters filters={filters} onUpdateFilter={updateFilter} onClearFilters={clearFilters} hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount} availableCities={availableCities} availableNeighborhoods={availableNeighborhoods} primaryColor={primaryColor} />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12"><Building className="h-12 w-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">Nenhum imóvel encontrado</p></div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filtered.map((p) => <PropertyCard key={p.id} property={p} primaryColor={primaryColor} orgSlug={org.slug} variant="horizontal" />)}
            </div>
          )}
        </div>
      </section>

      {/* ─── ABOUT: full-width bold section ─── */}
      {website?.about_text && (
        <section id="sobre" className="py-20 px-6" style={{ backgroundColor: `${primaryColor}08` }}>
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-2">Sobre nós</h2>
              <div className="h-1.5 w-20 rounded-full mb-6" style={{ backgroundColor: primaryColor }} />
              <div className="text-gray-600 leading-relaxed whitespace-pre-line text-lg">{website.about_text}</div>
            </div>
            <div className="hidden md:block relative">
              <div className="w-full aspect-square rounded-2xl" style={{ backgroundColor: `${primaryColor}15` }}>
                <div className="absolute inset-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
                  <span className="text-7xl font-black" style={{ color: `${primaryColor}30` }}>{properties.length}+</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── CONTACT: full-width colored ─── */}
      <section id="contato" className="py-16 px-6 text-white" style={{ backgroundColor: secondary }}>
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-black uppercase tracking-tight mb-8 text-center">Fale Conosco</h2>
          <form onSubmit={handleContact} className="space-y-4">
            <Input placeholder="Nome *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="border-white/20 bg-white/10 text-white placeholder:text-white/50" />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="E-mail" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="border-white/20 bg-white/10 text-white placeholder:text-white/50" />
              <Input placeholder="Telefone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="border-white/20 bg-white/10 text-white placeholder:text-white/50" />
            </div>
            <Textarea placeholder="Mensagem" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={3} className="border-white/20 bg-white/10 text-white placeholder:text-white/50" />
            <Button type="submit" disabled={sending} className="w-full gap-2 font-bold" style={{ backgroundColor: primaryColor, color: "white" }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ENVIAR
            </Button>
          </form>
        </div>
      </section>

      {/* ─── FOOTER: compact ─── */}
      <footer className="py-4 px-6 text-center text-xs" style={{ backgroundColor: secondary, color: "rgba(255,255,255,0.4)" }}>
        <p>© {new Date().getFullYear()} {org.name} — Todos os direitos reservados</p>
      </footer>
    </>
  );
}
