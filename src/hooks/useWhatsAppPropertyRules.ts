
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type RuleType = "whitelist" | "blacklist" | "highlight";

export interface PropertyRule {
  id: string;
  organization_id: string;
  property_id: string;
  rule_type: RuleType;
  created_at: string;
}

export function useWhatsAppPropertyRules() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["whatsapp-property-rules", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("whatsapp_property_rules" as any)
        .select("*")
        .eq("organization_id", orgId);
      if (error) throw error;
      return (data as any[]) as PropertyRule[];
    },
    enabled: !!orgId,
  });

  const addRule = useMutation({
    mutationFn: async ({ propertyId, ruleType }: { propertyId: string; ruleType: RuleType }) => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase
        .from("whatsapp_property_rules" as any)
        .insert({ organization_id: orgId, property_id: propertyId, rule_type: ruleType } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-property-rules"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao adicionar regra: " + err.message);
    },
  });

  const removeRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from("whatsapp_property_rules" as any)
        .delete()
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-property-rules"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover regra: " + err.message);
    },
  });

  const getByType = (type: RuleType) => rules.filter((r) => r.rule_type === type);

  return {
    rules,
    isLoading,
    whitelist: getByType("whitelist"),
    blacklist: getByType("blacklist"),
    highlights: getByType("highlight"),
    addRule: (propertyId: string, ruleType: RuleType) => addRule.mutateAsync({ propertyId, ruleType }),
    removeRule: (ruleId: string) => removeRule.mutateAsync(ruleId),
    isAdding: addRule.isPending,
    isRemoving: removeRule.isPending,
  };
}
