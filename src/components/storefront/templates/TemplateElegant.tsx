/**
 * ELEGANT template — Thin top nav with serif font, minimal centered hero with decorative lines,
 * 2-col masonry-like grid, elegant about with quote style, refined contact, minimal footer.
 */
import { useState, useMemo } from "react";
import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";
import { Building, Search, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export function TemplateElegant({ org, brand, website, properties, primaryColor }: TemplateProps) {
  const accent = brand?.accent_color || "#D4AF37";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "venda" | "aluguel">("all");
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (filter !== "all" && p.transaction_type !== filter && p.transaction_type !== "ambos") return false;
      if (search) {
        const s = search.toLowerCase();
        return p.title?.toLowerCase().includes(s) || p.address_city?.toLowerCase().includes(s) || p.address_neighborhood?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [properties, search, filter]);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || (!contactForm.email.trim() && !contactForm.phone.trim())) { toast.error("Preencha seu nome e pelo menos e-mail ou telefone."); return; }
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
      {/* ─── THIN TOP NAV with serif brand ─── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto border-b border-gray-200">
        {brand?.logo_url ? (
          <img src={brand.logo_url} alt={org.name} className="h-10 max-w-[180px] object-contain" />
        ) : (
          <span className="text-xl font-normal text-gray-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{org.name}</span>
        )}
        <div className="hidden sm:flex items-center gap-8">
          <a href="#imoveis" className="text-gray-400 hover:text-gray-900 text-xs uppercase tracking-[0.2em] transition-colors">Imóveis</a>
          <a href="#sobre" className="text-gray-400 hover:text-gray-900 text-xs uppercase tracking-[0.2em] transition-colors">Sobre</a>
          <a href="#contato" className="text-gray-400 hover:text-gray-900 text-xs uppercase tracking-[0.2em] transition-colors">Contato</a>
        </div>
      </nav>

      {/* ─── MINIMAL CENTERED HERO with decorative lines ─── */}
      <header className="px-6 py-28 md:py-40 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="h-px flex-1 max-w-16" style={{ backgroundColor: accent }} />
            <div className="w-2 h-2 rotate-45" style={{ backgroundColor: accent }} />
            <div className="h-px flex-1 max-w-16" style={{ backgroundColor: accent }} />
          </div>
          <h1 className="text-3xl md:text-5xl font-light text-gray-900 mb-6 leading-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {website?.hero_title || `Bem-vindo à ${org.name}`}
          </h1>
          <p className="text-base text-gray-500 max-w-xl mx-auto tracking-wide leading-relaxed">
            {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <div className="h-px flex-1 max-w-16" style={{ backgroundColor: accent }} />
            <div className="w-2 h-2 rotate-45" style={{ backgroundColor: accent }} />
            <div className="h-px flex-1 max-w-16" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </header>

      {/* ─── PROPERTIES: 2-col grid with thin borders ─── */}
      <section id="imoveis" className="py-16 px-6 bg-gray-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>Portfólio</p>
            <h2 className="text-2xl font-light" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Nossos Imóveis</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-8 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-gray-200 bg-white text-sm" />
            </div>
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white">
              {(["all", "venda", "aluguel"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 text-xs rounded font-medium transition-colors"
                  style={{ backgroundColor: filter === f ? primaryColor : "transparent", color: filter === f ? "#fff" : "#9ca3af" }}>
                  {f === "all" ? "Todos" : f === "venda" ? "Venda" : "Aluguel"}
                </button>
              ))}
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12"><Building className="h-12 w-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">Nenhum imóvel encontrado</p></div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {filtered.map((p) => <PropertyCard key={p.id} property={p} primaryColor={primaryColor} orgSlug={org.slug} />)}
            </div>
          )}
        </div>
      </section>

      {/* ─── ABOUT: quote style with accent border ─── */}
      {website?.about_text && (
        <section id="sobre" className="py-20 px-6 bg-white">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs uppercase tracking-[0.2em] text-center mb-6" style={{ color: accent }}>Quem Somos</p>
            <div className="relative pl-8 border-l-2" style={{ borderColor: accent }}>
              <div className="text-gray-600 leading-relaxed whitespace-pre-line italic text-base" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {website.about_text}
              </div>
              <p className="mt-6 text-sm font-semibold text-gray-900">— {org.name}</p>
            </div>
          </div>
        </section>
      )}

      {/* ─── CONTACT: clean centered ─── */}
      <section id="contato" className="py-16 px-6 bg-gray-50/50">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: accent }}>Contato</p>
          <h2 className="text-2xl font-light mb-8" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Entre em Contato</h2>
          <form onSubmit={handleContact} className="space-y-4 text-left">
            <Input placeholder="Nome *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="border-gray-200 bg-white" />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="E-mail" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="border-gray-200 bg-white" />
              <Input placeholder="Telefone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="border-gray-200 bg-white" />
            </div>
            <Textarea placeholder="Mensagem" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={3} className="border-gray-200 bg-white" />
            <Button type="submit" disabled={sending} className="w-full text-white gap-2" style={{ backgroundColor: primaryColor }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
            </Button>
          </form>
          {(website?.contact_phone || website?.contact_email) && (
            <div className="mt-8 text-sm text-gray-400 space-y-1">
              {website.contact_phone && <p>{website.contact_phone}</p>}
              {website.contact_email && <p>{website.contact_email}</p>}
            </div>
          )}
        </div>
      </section>

      {/* ─── FOOTER: minimal ─── */}
      <footer className="py-8 px-6 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} {org.name}</p>
          {brand?.tagline && <p>{brand.tagline}</p>}
        </div>
      </footer>
    </>
  );
}
