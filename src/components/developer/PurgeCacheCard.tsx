import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

export function PurgeCacheCard() {
  const [isPurging, setIsPurging] = useState(false);

  const handlePurge = async () => {
    if (!confirm("Limpar TODO o cache do Cloudflare (purge everything)? Isso afeta todos os visitantes.")) return;
    setIsPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-purge-cache", {
        method: "POST",
      });

      // FunctionsHttpError → fetch the JSON body for a useful message
      if (error) {
        let detail = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            detail = body?.error || body?.details?.[0]?.message || detail;
          } else if (ctx?.text) {
            detail = (await ctx.text()) || detail;
          }
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      if (data?.success) {
        toast.success("Cache do Cloudflare limpo com sucesso!");
      } else {
        throw new Error(data?.error || data?.details?.[0]?.message || "Erro desconhecido");
      }
    } catch (err: any) {
      toastError("Falha ao limpar cache", err, { module: "PurgeCacheCard" });
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Cloudflare Cache
        </CardTitle>
        <CardDescription>
          Limpar todo o cache do domínio no Cloudflare (Purge Everything)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePurge}
          disabled={isPurging}
          className="w-full"
        >
          {isPurging ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Limpando cache...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Purge Everything
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
