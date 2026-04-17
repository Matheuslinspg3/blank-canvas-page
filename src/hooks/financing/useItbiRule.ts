import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateItbi } from "@/lib/itbi/calculate";
import type { ResolvedItbi, ItbiCalculation } from "@/lib/itbi/types";

interface Params {
  ibgeCode?: string | null;
  uf?: string | null;
  organizationId?: string | null;
  propertyValue: number;
  financedValue?: number;
}

interface UseItbiRuleResult {
  resolved: ResolvedItbi | null;
  calculation: ItbiCalculation | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolve a regra de ITBI vigente (override > município > UF > fallback)
 * e retorna o cálculo aplicado ao valor do imóvel.
 */
export function useItbiRule({
  ibgeCode,
  uf,
  organizationId,
  propertyValue,
  financedValue = 0,
}: Params): UseItbiRuleResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["itbi-rule", ibgeCode ?? null, uf ?? null, organizationId ?? null],
    enabled: Boolean(uf || ibgeCode),
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<ResolvedItbi | null> => {
      const { data, error } = await supabase.rpc("resolve_itbi", {
        p_ibge: ibgeCode ?? null,
        p_uf: uf ?? null,
        p_org: organizationId ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return row as unknown as ResolvedItbi;
    },
  });

  const calculation = useMemo<ItbiCalculation | null>(() => {
    if (!data) return null;
    return calculateItbi({
      resolved: data,
      propertyValue,
      financedValue,
    });
  }, [data, propertyValue, financedValue]);

  return {
    resolved: data ?? null,
    calculation,
    isLoading,
    isError,
  };
}
