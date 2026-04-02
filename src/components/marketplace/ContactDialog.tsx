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

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá! Vi o imóvel "${property?.title}" no Marketplace Habitae e gostaria de mais informações.`
    );
    window.open(`https://wa.me/${fullPhone}?text=${message}`, "_blank");
  };

  if (!property) return null;

  const hasAnyData = contactData && (contactData.org_name || contactData.broker_name || contactData.broker_phone || contactData.org_phone || contactData.org_email);
  const brokerPhone = contactData?.broker_phone;
  const orgPhone = contactData?.org_phone;
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
        ) : !hasAnyData ? (
          <p className="text-muted-foreground text-center py-4">
            Dados de contato não disponíveis para este imóvel.
          </p>
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
                <Button className="w-full gap-2" variant="default" onClick={() => openWhatsApp(brokerPhone)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp do Corretor
                </Button>
              </div>
            )}

            {/* Org Phone */}
            {orgPhone && showBothPhones && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Imobiliária</p>
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
                <Button className="w-full gap-2" variant="outline" onClick={() => openWhatsApp(orgPhone)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp da Imobiliária
                </Button>
              </div>
            )}

            {/* Fallback: only org phone when no broker phone */}
            {orgPhone && !brokerPhone && (
              <div className="space-y-2">
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
                <Button className="w-full gap-2" variant="default" onClick={() => openWhatsApp(orgPhone)}>
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
