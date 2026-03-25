import { useQuery } from "@tanstack/react-query";

interface BcbSeriesItem {
  data: string;
  valor: string;
}

/**
 * Busca a taxa Selic Meta anualizada (série 432) da API pública do BCB.
 * Retorna o valor anualizado mais recente (ex: 14.25).
 */
export function useSelicRate() {
  return useQuery({
    queryKey: ["selic-rate"],
    queryFn: async (): Promise<number> => {
      // Série 432 = Meta Selic decidida pelo Copom (% a.a.)
      const url =
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao buscar Selic do BCB");
      const data: BcbSeriesItem[] = await res.json();
      if (!data.length) throw new Error("Sem dados da Selic");
      return parseFloat(data[0].valor.replace(",", "."));
    },
    staleTime: 1000 * 60 * 60 * 4, // 4h cache
    retry: 2,
  });
}
