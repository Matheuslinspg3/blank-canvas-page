import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/posthog";

export type ShareLinkResult = {
  link: string;
  usedFallback: boolean;
  reason?:
    | "broker-without-phone"
    | "missing-data"
    | "insert-failed"
    | "rls-insert-denied"
    | "share-link-slug-too-long"
    | "share-link-unique-conflict";
};

export function useShareLink() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateShareLink = async (
    propertyId: string,
  ): Promise<ShareLinkResult | null> => {
    if (!profile?.user_id || !profile?.organization_id) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado.",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    try {
      // Resolve org slug + property code (used both for attributed link and public fallback).
      const [orgRes, propRes] = await Promise.all([
        supabase
          .from("organizations")
          .select("slug")
          .eq("id", profile.organization_id)
          .maybeSingle(),
        supabase
          .from("properties")
          .select("property_code")
          .eq("id", propertyId)
          .maybeSingle(),
      ]);

      const orgSlug = orgRes.data?.slug;
      const propertyCode = propRes.data?.property_code;

      if (!orgSlug || !propertyCode) {
        console.error("share link missing data:", {
          orgErr: orgRes.error,
          propErr: propRes.error,
          orgSlug,
          propertyCode,
        });
        toast({
          title: "Erro",
          description: "Não foi possível gerar o link.",
          variant: "destructive",
        });
        return null;
      }

      const base = `${window.location.origin}/i/${orgSlug}/${propertyCode}`;

      // Reuse existing active share link record for this broker+property
      // (stable token per broker — avoids re-triggering phone check).
      const { data: existing, error: selectErr } = await (supabase
        .from("property_share_links" as any)
        .select("id, broker_token")
        .eq("property_id", propertyId)
        .eq("broker_id", profile.user_id)
        .eq("active", true)
        .maybeSingle() as any);

      if (selectErr) {
        console.error("share link select error:", selectErr);
      }

      if (existing?.broker_token) {
        trackEvent("imovel_compartilhado", { propertyId });
        return {
          link: `${base}/${existing.broker_token}`,
          usedFallback: false,
        };
      }

      // Cap slug at 120 chars (matches new column size — defense in depth).
      const slug = `${orgSlug}-${propertyCode}`.slice(0, 120);

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
        console.error("share link insert error:", insertErr);
        const code = insertErr.code as string | undefined;
        const blob =
          `${insertErr.message ?? ""} ${insertErr.details ?? ""} ${insertErr.hint ?? ""}`.toLowerCase();

        // Phone trigger blocked the insert (check_violation).
        const isPhoneBlock =
          code === "23514" ||
          blob.includes("telefone") ||
          blob.includes("phone");

        if (isPhoneBlock) {
          toast({
            title: "Telefone obrigatório",
            description:
              "Cadastre seu telefone no perfil para gerar link com corretor. Usando link público sem atribuição.",
            variant: "destructive",
          });
          trackEvent("imovel_compartilhado", {
            propertyId,
            fallback: "no-phone",
          });
          return {
            link: base,
            usedFallback: true,
            reason: "broker-without-phone",
          };
        }

        // Slug too long for the column — should not happen after migration,
        // but kept as a safety net.
        if (code === "22001") {
          toast({
            title: "Identificador muito longo",
            description:
              "Não foi possível criar o token do corretor. Usando link público.",
            variant: "destructive",
          });
          return {
            link: base,
            usedFallback: true,
            reason: "share-link-slug-too-long",
          };
        }

        // Unique conflict on slug (already exists for another broker/record).
        if (code === "23505") {
          toast({
            title: "Link já existente",
            description:
              "Já existe um link para este imóvel sob outro corretor. Usando link público.",
            variant: "destructive",
          });
          return {
            link: base,
            usedFallback: true,
            reason: "share-link-unique-conflict",
          };
        }

        // RLS / permission denied — never silently degrade to public.
        if (code === "42501" || blob.includes("row-level security")) {
          toast({
            title: "Sem permissão",
            description:
              "Você não tem permissão para gerar o link deste imóvel.",
            variant: "destructive",
          });
          return null;
        }

        // Unknown DB error — surface clearly, do NOT mask as public link.
        toast({
          title: "Falha ao criar link seguro",
          description:
            "Não foi possível criar o token do corretor para este imóvel.",
          variant: "destructive",
        });
        return null;
      }

      const brokerToken = inserted?.broker_token as string | undefined;
      trackEvent("imovel_compartilhado", { propertyId });

      if (!brokerToken) {
        // Insert succeeded but trigger did not assign a token — degrade to public.
        return {
          link: base,
          usedFallback: true,
          reason: "insert-failed",
        };
      }

      return {
        link: `${base}/${brokerToken}`,
        usedFallback: false,
      };
    } catch (err) {
      console.error("Error generating share link:", err);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o link.",
        variant: "destructive",
      });
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
      toast({
        title: "Erro",
        description: "Não foi possível revogar o link.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Link revogado",
        description: "O link público foi desativado.",
      });
    }
  };

  return { generateShareLink, revokeShareLink, isGenerating };
}
