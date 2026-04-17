import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";

export function useShareLink() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateShareLink = async (propertyId: string): Promise<string | null> => {
    if (!profile?.user_id || !profile?.organization_id) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return null;
    }

    setIsGenerating(true);
    try {
      // Get org slug and property code to build the short URL
      const [{ data: orgData }, { data: propData }] = await Promise.all([
        supabase
          .from("organizations")
          .select("slug")
          .eq("id", profile.organization_id)
          .single(),
        supabase
          .from("properties")
          .select("property_code")
          .eq("id", propertyId)
          .single(),
      ]);

      if (!orgData?.slug || !propData?.property_code) {
        toast({ title: "Erro", description: "Não foi possível gerar o link.", variant: "destructive" });
        return null;
      }

      // Reuse existing share link record for this broker+property (stable token per broker)
      const { data: existing } = await (supabase
        .from("property_share_links" as any)
        .select("id, broker_token")
        .eq("property_id", propertyId)
        .eq("broker_id", profile.user_id)
        .eq("active", true)
        .maybeSingle() as any);

      let brokerToken: string | null = existing?.broker_token ?? null;

      if (!existing) {
        const slug = `${orgData.slug}-${propData.property_code}`;
        const { data: inserted, error: insertErr } = await (supabase
          .from("property_share_links" as any)
          .insert({
            property_id: propertyId,
            broker_id: profile.user_id,
            slug,
            active: true,
          })
          .select("broker_token")
          .single() as any);

        if (insertErr) {
          // Trigger may reject if broker has no phone
          const msg = insertErr.message?.includes("telefone")
            ? "Cadastre seu telefone no perfil antes de compartilhar a landing page."
            : "Não foi possível gerar o link.";
          toast({ title: "Erro", description: msg, variant: "destructive" });
          return null;
        }
        brokerToken = inserted?.broker_token ?? null;
      }

      trackEvent('imovel_compartilhado', { propertyId });

      const base = `${window.location.origin}/i/${orgData.slug}/${propData.property_code}`;
      return brokerToken ? `${base}/${brokerToken}` : base;
    } catch (err) {
      console.error("Error generating share link:", err);
      toast({ title: "Erro", description: "Não foi possível gerar o link.", variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeShareLink = async (propertyId: string) => {
    if (!profile?.user_id) return;

    const { error } = await supabase
      .from("property_share_links" as any)
      .update({ active: false })
      .eq("property_id", propertyId)
      .eq("broker_id", profile.user_id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível revogar o link.", variant: "destructive" });
    } else {
      toast({ title: "Link revogado", description: "O link público foi desativado." });
    }
  };

  return { generateShareLink, revokeShareLink, isGenerating };
}
