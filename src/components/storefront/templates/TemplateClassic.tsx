/**
 * CLASSIC template — Top navbar, centered gradient hero, 3-col grid, centered about, contact form below, footer.
 */
import { useState, useMemo } from "react";
import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite, StorefrontProperty } from "@/hooks/useStorefront";
import { Building, Bed, Bath, Car, Maximize, Star, Search, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TemplateProps {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
  properties: StorefrontProperty[];
  primaryColor: string;
}

function formatPrice(value: number | null) {
  if (!value) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function TemplateClassic({ org, brand, website, properties, primaryColor }: TemplateProps) {
  const secondary = brand?.secondary_color || "#1E293B";
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
      {/* ─── TOP NAV ─── */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${secondary}, ${primaryColor})` }}>
        <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          {brand?.logo_dark_url || brand?.logo_url ? (
            <img src={brand.logo_dark_url || brand.logo_url!} alt={org.name} className="h-10 max-w-[180px] object-contain" />
          ) : (
            <span className="text-xl font-bold text-white">{org.name}</span>
          )}
          <div className="hidden sm:flex items-center gap-4">
            <a href="#imoveis" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Imóveis</a>
            <a href="#sobre" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Sobre</a>
            <a href="#contato" className="text-white/80 hover:text-white text-sm font-medium transition-colors">Contato</a>
          </div>
        </nav>
        <div className="relative z-10 px-6 py-20 md:py-32 max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
            {website?.hero_title || `Bem-vindo à ${org.name}`}
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            {website?.hero_subtitle || brand?.slogan || "Encontre o imóvel ideal para você"}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 bg-white -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 bg-white translate-y-1/3 -translate-x-1/4" />
      </header>

      {/* ─── PROPERTIES: 3-col grid centered ─── */}
      <section id="imoveis" className="py-16 px-6 max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Nossos Imóveis</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-8 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por cidade, bairro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-gray-200 bg-white" />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["all", "venda", "aluguel"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="px-4 py-2 text-sm rounded-md font-medium transition-colors"
                style={{ backgroundColor: filter === f ? primaryColor : "transparent", color: filter === f ? "#fff" : "#6b7280" }}>
                {f === "all" ? "Todos" : f === "venda" ? "Venda" : "Aluguel"}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12"><Building className="h-12 w-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">Nenhum imóvel encontrado</p></div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => <PropertyCard key={p.id} property={p} primaryColor={primaryColor} orgSlug={org.slug} />)}
          </div>
        )}
      </section>

      {/* ─── ABOUT: centered with left border ─── */}
      {website?.about_text && (
        <section id="sobre" className="py-16 px-6 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Sobre a {org.name}</h2>
            <div className="text-gray-600 leading-relaxed whitespace-pre-line" style={{ borderLeft: `3px solid ${primaryColor}`, paddingLeft: "1.5rem", textAlign: "left" }}>
              {website.about_text}
            </div>
          </div>
        </section>
      )}

      {/* ─── CONTACT: centered form ─── */}
      <section id="contato" className="py-16 px-6 bg-gray-50">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Entre em Contato</h2>
          <p className="text-gray-500 text-center mb-8">Preencha o formulário e nossa equipe entrará em contato</p>
          <form onSubmit={handleContact} className="space-y-4 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <Input placeholder="Seu nome *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="border-gray-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input placeholder="E-mail" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="border-gray-200" />
              <Input placeholder="Telefone / WhatsApp" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="border-gray-200" />
            </div>
            <Textarea placeholder="Mensagem (opcional)" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} rows={4} className="border-gray-200" />
            <Button type="submit" disabled={sending} className="w-full text-white gap-2" style={{ backgroundColor: primaryColor }}>
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

      {/* ─── FOOTER ─── */}
      <footer className="py-8 px-6 text-center text-sm" style={{ backgroundColor: secondary, color: "rgba(255,255,255,0.6)" }}>
        <div className="max-w-7xl mx-auto">
          {brand?.logo_dark_url && <img src={brand.logo_dark_url} alt={org.name} className="h-8 mx-auto mb-4 object-contain" />}
          <p>© {new Date().getFullYear()} {org.name}. Todos os direitos reservados.</p>
          {brand?.tagline && <p className="mt-1 text-xs">{brand.tagline}</p>}
        </div>
      </footer>
    </>
  );
}

// ─── Shared Property Card ────────────────────────────────────────────────────
export function PropertyCard({ property: p, primaryColor, orgSlug, variant = "card" }: { property: StorefrontProperty; primaryColor: string; orgSlug: string; variant?: "card" | "horizontal" | "minimal" }) {
  const img = p.images?.[0];
  const price = p.transaction_type === "aluguel" ? formatPrice(p.rent_price) : formatPrice(p.sale_price);
  const priceLabel = p.transaction_type === "aluguel" ? "/mês" : "";

  if (variant === "horizontal") {
    return (
      <a href={`/i/${orgSlug}/${p.id}`} className="group flex flex-col sm:flex-row rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
        <div className="relative w-full sm:w-72 aspect-[16/10] sm:aspect-auto sm:h-48 bg-gray-100 shrink-0">
          {img ? <img src={img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /> : <div className="flex items-center justify-center h-full"><Building className="h-10 w-10 text-gray-300" /></div>}
          {p.is_featured && <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: primaryColor }}><Star className="h-3 w-3" /> Destaque</span>}
        </div>
        <div className="p-4 flex flex-col justify-between flex-1">
          <div>
            <h3 className="font-semibold text-gray-900">{p.title}</h3>
            {(p.address_neighborhood || p.address_city) && <p className="text-sm text-gray-500 mt-1">{[p.address_neighborhood, p.address_city, p.address_state].filter(Boolean).join(", ")}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {p.bedrooms != null && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>}
              {p.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>}
              {p.parking_spots != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {p.parking_spots}</span>}
              {p.area_total != null && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.area_total}m²</span>}
            </div>
          </div>
          {price && <p className="mt-3 text-lg font-bold" style={{ color: primaryColor }}>{price}<span className="text-sm font-normal text-gray-500">{priceLabel}</span></p>}
        </div>
      </a>
    );
  }

  if (variant === "minimal") {
    return (
      <a href={`/i/${orgSlug}/${p.id}`} className="group flex items-center gap-4 py-4 border-b border-gray-100 hover:bg-gray-50 px-2 rounded transition-colors">
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
          {img ? <img src={img} alt={p.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="flex items-center justify-center h-full"><Building className="h-6 w-6 text-gray-300" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{p.title}</h3>
          <p className="text-xs text-gray-500 truncate">{[p.address_neighborhood, p.address_city].filter(Boolean).join(", ")}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            {p.bedrooms != null && <span>{p.bedrooms} quartos</span>}
            {p.area_total != null && <span>{p.area_total}m²</span>}
          </div>
        </div>
        {price && <p className="text-base font-bold shrink-0" style={{ color: primaryColor }}>{price}</p>}
      </a>
    );
  }

  // Default card
  return (
    <a href={`/i/${orgSlug}/${p.id}`} className="group block rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
      <div className="relative aspect-[16/10] bg-gray-100">
        {img ? <img src={img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /> : <div className="flex items-center justify-center h-full"><Building className="h-10 w-10 text-gray-300" /></div>}
        {p.is_featured && <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: primaryColor }}><Star className="h-3 w-3" /> Destaque</span>}
        <span className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-700">
          {p.transaction_type === "aluguel" ? "Aluguel" : p.transaction_type === "venda" ? "Venda" : "Venda/Aluguel"}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
        {(p.address_neighborhood || p.address_city) && <p className="text-sm text-gray-500 mt-1 truncate">{[p.address_neighborhood, p.address_city, p.address_state].filter(Boolean).join(", ")}</p>}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          {p.bedrooms != null && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>}
          {p.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>}
          {p.parking_spots != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {p.parking_spots}</span>}
          {p.area_total != null && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.area_total}m²</span>}
        </div>
        {price && <p className="mt-3 text-lg font-bold" style={{ color: primaryColor }}>{price}<span className="text-sm font-normal text-gray-500">{priceLabel}</span></p>}
      </div>
    </a>
  );
}
