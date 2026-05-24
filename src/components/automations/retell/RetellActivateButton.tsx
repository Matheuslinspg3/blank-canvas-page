import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { sendWhatsAppWebhook, buildWhatsAppPayload } from "@/services/whatsapp/webhookService";

export function RetellActivateButton() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const handleActivate = async () => {
    setLoading(true);
    try {
      const { data: organization } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profile?.organization_id)
        .maybeSingle();

      const payload = buildWhatsAppPayload(
        "create",
        "ai_agent",
        { user, profile, organization }
      );

      const result = await sendWhatsAppWebhook(payload);

      if (!result.ok) {
        throw new Error(result.error);
      }

      toast.success(result.message || "Solicitação de ativação enviada!");
      queryClient.invalidateQueries({ queryKey: ["retell-agent-config"] });
    } catch (err: any) {
      toast.error("Erro ao ativar Sofia: " + (err.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Ativar Sofia — Agente de voz
        </CardTitle>
        <CardDescription>
          Sofia é sua assistente virtual que liga para leads, qualifica interesse e transfere para um corretor.
          Com 1 clique criamos um agente exclusivo para sua imobiliária com fluxo padrão pronto para uso —
          você pode personalizar tudo depois na aba Flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Agente exclusivo para sua organização</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Fluxo de qualificação padrão (editável)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Discagem automática para novos leads</li>
        </ul>

        <Button onClick={handleActivate} disabled={loading} size="lg" className="w-full sm:w-auto">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ativando Sofia...</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Ativar Sofia agora</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
