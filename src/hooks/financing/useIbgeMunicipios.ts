import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IbgeMunicipio {
  ibge_code: string;
  uf: string;
  name: string;
  capital: boolean;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * Lista municípios de uma UF, opcionalmente filtrados por busca textual.
 */
export function useIbgeMunicipios(uf: string | undefined, search = "") {
  return useQuery({
    queryKey: ["ibge-municipios", uf, normalize(search)],
    enabled: Boolean(uf),
    staleTime: 1000 * 60 * 60,
    queryFn: async (): Promise<IbgeMunicipio[]> => {
      let query = supabase
        .from("ibge_municipios")
        .select("ibge_code,uf,name,capital")
        .eq("uf", uf!)
        .order("name", { ascending: true })
        .limit(200);

      const term = normalize(search);
      if (term.length >= 2) {
        query = query.ilike("name_normalized", `%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as IbgeMunicipio[];
    },
  });
}
