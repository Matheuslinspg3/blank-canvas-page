import { useQuery } from "@tanstack/react-query";

interface BcbSeriesItem {
  data: string;
  valor: string;
}

const TR_FALLBACK = 0.1690;

/**
 * Busca a Taxa Referencial (TR) mensal da API pública do BCB (série 7811).
 * Retorna o valor mensal em % (ex: 0.1690).
 */
export function useTaxaReferencial() {
  return useQuery({
    queryKey: ["taxa-referencial"],
    queryFn: async (): Promise<number> => {
      const url =
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.7811/dados/ultimos/1?formato=json";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao buscar TR do BCB");
      const data: BcbSeriesItem[] = await res.json();
      if (!data.length) throw new Error("Sem dados da TR");
      return parseFloat(data[0].valor.replace(",", "."));
    },
    staleTime: 1000 * 60 * 60 * 24, // 24h
    retry: 2,
    placeholderData: TR_FALLBACK,
  });
}

export { TR_FALLBACK };
