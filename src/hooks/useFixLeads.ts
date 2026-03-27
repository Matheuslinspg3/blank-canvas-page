import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { useQueryClient } from "@tanstack/react-query";

export function useFixLeads() {
  const [isFixing, setIsFixing] = useState(false);
  const queryClient = useQueryClient();

  const fixLeads = async (source: "rdstation" | "meta_ads" | "all") => {
    setIsFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fix-leads", {
        body: { source },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parts: string[] = [];
      if (data.enriched > 0) parts.push(`${data.enriched} enriquecidos via API`);
      if (data.fixed > 0) parts.push(`${data.fixed} campos preenchidos`);
      if (data.merged > 0) parts.push(`${data.merged} duplicatas mescladas`);
      if (data.source_updated > 0) parts.push(`${data.source_updated} origens corrigidas`);

      if (parts.length === 0) {
        toast.info(`${data.total_analyzed} leads analisados — nenhuma correção necessária.`);
      } else {
        toast.success(`Leads corrigidos: ${parts.join(", ")}`);
      }

      // Invalidate all lead-related queries
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["rd-station-leads"] });
      queryClient.invalidateQueries({ queryKey: ["ad-leads"] });
    } catch (err: any) {
      toastError("Erro ao corrigir leads.", err, { module: "useFixLeads" });
    } finally {
      setIsFixing(false);
    }
  };

  return { fixLeads, isFixing };
}
