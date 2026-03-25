import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BankRate {
  id: string;
  bank_name: string;
  bank_code: string;
  rate_min: number;
  rate_max: number;
  spread_over_selic: number;
  max_ltv: number;
  max_term_months: number;
  notes: string | null;
  is_active: boolean;
}

/** Default rates used when org has no custom rates yet */
export const DEFAULT_BANK_RATES: Omit<BankRate, "id">[] = [
  { bank_name: "Caixa Econômica", bank_code: "caixa", rate_min: 8.99, rate_max: 11.49, spread_over_selic: 0, max_ltv: 80, max_term_months: 420, notes: null, is_active: true },
  { bank_name: "Banco do Brasil", bank_code: "bb", rate_min: 9.39, rate_max: 11.69, spread_over_selic: 0, max_ltv: 80, max_term_months: 420, notes: null, is_active: true },
  { bank_name: "Itaú", bank_code: "itau", rate_min: 9.5, rate_max: 11.59, spread_over_selic: 0, max_ltv: 80, max_term_months: 360, notes: null, is_active: true },
  { bank_name: "Bradesco", bank_code: "bradesco", rate_min: 9.5, rate_max: 11.9, spread_over_selic: 0, max_ltv: 80, max_term_months: 360, notes: null, is_active: true },
  { bank_name: "Santander", bank_code: "santander", rate_min: 9.49, rate_max: 11.99, spread_over_selic: 0, max_ltv: 80, max_term_months: 360, notes: null, is_active: true },
];

export function useBankRates() {
  return useQuery({
    queryKey: ["financing-bank-rates"],
    queryFn: async (): Promise<BankRate[]> => {
      const { data, error } = await supabase
        .from("financing_bank_rates" as any)
        .select("*")
        .eq("is_active", true)
        .order("bank_name");

      if (error) throw error;

      // If org has custom rates, use them; otherwise fall back to defaults
      if (data && data.length > 0) {
        return (data as any[]).map((r) => ({
          id: r.id,
          bank_name: r.bank_name,
          bank_code: r.bank_code,
          rate_min: Number(r.rate_min),
          rate_max: Number(r.rate_max),
          spread_over_selic: Number(r.spread_over_selic),
          max_ltv: Number(r.max_ltv),
          max_term_months: Number(r.max_term_months),
          notes: r.notes,
          is_active: r.is_active,
        }));
      }

      return DEFAULT_BANK_RATES.map((r, i) => ({ ...r, id: `default-${i}` }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
