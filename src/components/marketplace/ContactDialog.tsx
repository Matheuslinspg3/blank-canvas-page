import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, User, Mail, Copy, Check, Loader2, MessageCircle, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceProperty } from "@/hooks/useMarketplace";

interface ContactDialogProps {
  property: MarketplaceProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContactData {
  org_name: string | null;
  org_phone: string | null;
  org_email: string | null;
  org_logo: string | null;
  broker_name: string | null;
  broker_phone: string | null;
  broker_avatar: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  marketplace_contact_source?: 'organization' | 'owner' | 'custom' | null;
  resolved_marketplace_contact_phone?: string | null;
  resolved_marketplace_contact_label?: string | null;
  contact_resolution_status?: 'ok' | 'fallback' | 'missing' | null;
}

export function ContactDialog({ property, open, onOpenChange }: ContactDialogProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [contactData, setContactData] = useState<ContactData | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  useEffect(() => {
    if (open && property) {
      setLoadingContact(true);
      setContactData(null);
      supabase.rpc("get_marketplace_contact", { p_property_id: property.id } as any)
        .then(({ data, error }) => {
          if (!error && data) setContactData(data as unknown as ContactData);
          setLoadingContact(false);
        });
    }
  }, [open, property]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copiado!", description: `${field} copiado para a área de transferência.` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const registerIntent = async (phone: string, contactType: "broker" | "org") => {
    if (!property) return;
    const locationParts = [property.address_neighborhood, property.address_city].filter(Boolean);
    const price = property.sale_price || property.rent_price;

    try {
      await supabase.from("marketplace_contact_intents" as any).insert({
        organization_id: property.organization_id,
        target_phone: phone,
        contact_type: contactType,
        property_id: property.id,
        property_title: property.title,
        property_code: property.external_code || null,
        property_location: locationParts.length ? locationParts.join(" - ") : null,
        property_price: price || null,
        property_transaction_type: property.sale_price ? "venda" : property.rent_price ? "aluguel" : null,
        source_org_name: null,
        broker_name: contactData?.broker_name || null,
        org_name: contactData?.org_name || null,
      });
    } catch {
      // Non-blocking: intent is a bonus, not a requirement
    }
  };

  const openWhatsApp = async (phone: string, contactType: "broker" | "org" = "broker") => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Register intent in DB so the org's AI has context even if user deletes the message
    registerIntent(phone, contactType);

    const parts: string[] = [];
    parts.push(`Olá! Encontrei o imóvel "${property?.title}"`);
    if (property?.external_code) parts.push(`(Cód: ${property.external_code})`);
    parts.push("no *Porta do Corretor*");
    if (contactData?.org_name) parts.push(`anunciado pela imobiliária *${contactData.org_name}*`);

    const locationParts = [property?.address_neighborhood, property?.address_city].filter(Boolean);
    if (locationParts.length) parts.push(`localizado em ${locationParts.join(" - ")}`);

    const price = property?.sale_price || property?.rent_price;
    if (price) {
      const formattedPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(price);
      const txType = property?.sale_price ? "venda" : "aluguel";
      parts.push(`valor de ${txType}: ${formattedPrice}`);
    }

    let msg = parts.join(", ") + ".";
    if (contactType === "org") {
      msg += "\n\nGostaria de mais informações sobre este imóvel.";
    } else {
      msg += "\n\nGostaria de mais informações sobre este imóvel com o corretor responsável.";
    }

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (!property) return null;

  const brokerPhone = contactData?.broker_phone;
  const orgPhone = contactData?.org_phone;
  const hasPhone = !!(brokerPhone || orgPhone);
  // Show both phones if different, otherwise just one
  const showBothPhones = brokerPhone && orgPhone && brokerPhone.replace(/\D/g, "") !== orgPhone.replace(/\D/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contato</DialogTitle>
          <DialogDescription>{property.title}</DialogDescription>
        </DialogHeader>
        {loadingContact ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasPhone ? (
          <div className="space-y-4 py-2">
            {contactData?.org_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10 shrink-0">
                  {contactData.org_logo && <AvatarImage src={contactData.org_logo} alt={contactData.org_name} />}
                  <AvatarFallback><Building className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{contactData.org_name}</p>
                  <p className="text-xs text-muted-foreground">Imobiliária responsável</p>
                </div>
              </div>
            )}
            {contactData?.org_email && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{contactData.org_email}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(contactData.org_email!, "Email")}>
                  {copiedField === "Email" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              {contactData?.org_email
                ? "Sem telefone público cadastrado. Você pode notificar a imobiliária — ela receberá um aviso no sistema."
                : "Esta imobiliária ainda não cadastrou um contato público. Notifique-os e eles receberão um aviso no sistema para entrar em contato com você."}
            </p>
            <Button
              className="w-full gap-2"
              variant="default"
              onClick={async () => {
                try {
                  const { data, error } = await supabase.rpc("notify_marketplace_interest" as any, {
                    p_property_id: property.id,
                  });
                  if (error) throw error;
                  const notified = (data as any)?.notified ?? 0;
                  toast({
                    title: "Imobiliária notificada",
                    description: notified > 0
                      ? `Avisamos ${notified} responsável(is) da imobiliária. Em breve devem entrar em contato.`
                      : "Registramos seu interesse. A imobiliária será avisada.",
                  });
                  onOpenChange(false);
                } catch (err: any) {
                  toast({
                    title: "Não foi possível registrar",
                    description: err?.message || "Tente novamente em instantes.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <MessageCircle className="h-4 w-4" />
              Notificar imobiliária do meu interesse
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Organization section */}
            {contactData.org_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10 shrink-0">
                  {contactData.org_logo && <AvatarImage src={contactData.org_logo} alt={contactData.org_name} />}
                  <AvatarFallback><Building className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{contactData.org_name}</p>
                  <p className="text-xs text-muted-foreground">Imobiliária</p>
                </div>
              </div>
            )}

            {/* Broker section */}
            {contactData.broker_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10 shrink-0">
                  {contactData.broker_avatar && <AvatarImage src={contactData.broker_avatar} alt={contactData.broker_name} />}
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{contactData.broker_name}</p>
                  <p className="text-xs text-muted-foreground">Corretor</p>
                </div>
              </div>
            )}

            {/* Broker Phone */}
            {brokerPhone && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Corretor</p>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{brokerPhone}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(brokerPhone, "Tel. Corretor")}>
                    {copiedField === "Tel. Corretor" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button className="w-full gap-2" variant="default" onClick={() => openWhatsApp(brokerPhone, "broker")}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp do Corretor
                </Button>
              </div>
            )}

            {/* Org Phone (resolvido por source) */}
            {orgPhone && showBothPhones && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {contactData.resolved_marketplace_contact_label || 'Imobiliária'}
                </p>
                {contactData.contact_resolution_status === 'fallback' && contactData.marketplace_contact_source === 'owner' && (
                  <div className="text-[11px] text-warning-foreground/90 bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
                    Telefone do proprietário indisponível — usando contato da imobiliária.
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{orgPhone}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(orgPhone, "Tel. Imobiliária")}>
                    {copiedField === "Tel. Imobiliária" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button className="w-full gap-2" variant="outline" onClick={() => openWhatsApp(orgPhone, "org")}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp da Imobiliária
                </Button>
              </div>
            )}

            {/* Fallback: only org phone when no broker phone */}
            {orgPhone && !brokerPhone && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  {contactData.resolved_marketplace_contact_label || 'Contato'}
                </p>
                {contactData.contact_resolution_status === 'fallback' && contactData.marketplace_contact_source === 'owner' && (
                  <div className="text-[11px] text-warning-foreground/90 bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
                    Telefone do proprietário indisponível — usando contato da imobiliária.
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{orgPhone}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(orgPhone, "Telefone")}>
                    {copiedField === "Telefone" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button className="w-full gap-2" variant="default" onClick={() => openWhatsApp(orgPhone, "org")}>
                  <MessageCircle className="h-4 w-4" />
                  Conversar no WhatsApp
                </Button>
              </div>
            )}

            {/* Email */}
            {contactData.org_email && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{contactData.org_email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(contactData.org_email!, "Email")}
                >
                  {copiedField === "Email" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
