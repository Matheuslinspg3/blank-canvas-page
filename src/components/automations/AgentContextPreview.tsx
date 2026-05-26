import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, RefreshCw, Wallet, MapPin, Building2, Mic2, MessageCircle, Bot, FileText, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AgentContext {
  organization_id: string;
  instance_name: string | null;
  voice_id: string;
  agent_config: any;
  ai_config: { provider: string; model: string; mode: string };
  voice_config: { enabled: boolean; percentage: number; voice_id: string; tts_endpoint: string };
  composed_system_prompt: string;
  neighborhoods: Record<string, string[]>;
  properties: { enabled: boolean; items: any[]; total: number; returned?: number; preview_limit?: number; access_mode?: string; search_tool?: string };
  credits: { has_credits: boolean; balance_brl: number; friendly_message: string | null };
  welcome: { message: string | null; media_url: string | null; media_type: string | null; delay_seconds: number; reason: string };
}

export function AgentContextPreview() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["whatsapp-agent-context-preview", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase.functions.invoke("whatsapp-agent-config", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      return data as AgentContext;
    },
    enabled: !!orgId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-4 text-sm text-destructive">
          Erro ao carregar contexto do agente: {(error as Error)?.message || "sem dados"}
        </CardContent>
      </Card>
    );
  }

  const neighborhoodEntries = Object.entries(data.neighborhoods || {});
  const propertyItems = data.properties?.items || [];

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold font-display">
              Contexto enviado ao agente (preview)
            </CardTitle>
            <CardDescription>
              Tudo que o n8n recebe no node IDENTIDADE em cada mensagem
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard icon={<Bot className="h-3.5 w-3.5" />} label="Modelo IA" value={`${data.ai_config?.provider}/${data.ai_config?.model}`} />
          <StatCard icon={<Wallet className="h-3.5 w-3.5" />} label="Créditos" value={`R$ ${(data.credits?.balance_brl ?? 0).toFixed(2)}`} highlight={data.credits?.has_credits ? "success" : "danger"} />
          <StatCard icon={<MapPin className="h-3.5 w-3.5" />} label="Bairros" value={String(neighborhoodEntries.length)} />
          <StatCard icon={<Building2 className="h-3.5 w-3.5" />} label="Imóveis ativos" value={String(data.properties?.total ?? 0)} highlight={data.properties?.enabled ? "success" : "muted"} />
        </div>

        <Accordion type="multiple" className="border-t pt-2">
          {/* System prompt composto */}
          <AccordionItem value="prompt">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> System prompt composto</div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-72 rounded-md border bg-muted/30 p-3">
                <pre className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed">{data.composed_system_prompt}</pre>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>

          {/* Voz */}
          <AccordionItem value="voice">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><Mic2 className="h-4 w-4 text-primary" /> Configuração de voz</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-1.5 text-xs pt-2">
              <Row k="Habilitada" v={data.voice_config?.enabled ? "Sim" : "Não"} />
              <Row k="Probabilidade" v={`${data.voice_config?.percentage ?? 0}%`} />
              <Row k="Voice ID" v={data.voice_config?.voice_id} mono />
              <Row k="TTS endpoint" v={data.voice_config?.tts_endpoint} mono />
            </AccordionContent>
          </AccordionItem>

          {/* Boas-vindas */}
          <AccordionItem value="welcome">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Boas-vindas (rotação)</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-1.5 text-xs pt-2">
              <Row k="Status" v={data.welcome?.reason || "—"} />
              <Row k="Mensagem" v={data.welcome?.message || "(sem mensagem agora)"} />
              <Row k="Mídia" v={data.welcome?.media_url || "—"} mono />
              <Row k="Delay" v={`${data.welcome?.delay_seconds ?? 0}s`} />
            </AccordionContent>
          </AccordionItem>

          {/* Bairros */}
          <AccordionItem value="neighborhoods">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Bairros indexados ({neighborhoodEntries.length})</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {neighborhoodEntries.map(([name, ids]) => (
                  <Badge key={name} variant="secondary" className="gap-1">
                    {name} <span className="text-muted-foreground">({ids.length})</span>
                  </Badge>
                ))}
                {neighborhoodEntries.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhum bairro com imóveis ativos</span>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Catálogo */}
          <AccordionItem value="properties">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Amostra do catálogo ({data.properties?.returned ?? propertyItems.length}/{data.properties?.total ?? 0})</div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mb-2 flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                <Search className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>
                  Esta lista é só uma prévia rápida enviada no contexto do node IDENTIDADE. A IA consulta o catálogo completo sob demanda pela tool {data.properties?.search_tool || "whatsapp-agent-properties"}, aplicando filtros de bairro, tipo, valor e transação.
                </span>
              </div>
              <ScrollArea className="h-72 rounded-md border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                    <tr className="text-left">
                      <th className="px-2 py-1.5">Cód.</th>
                      <th className="px-2 py-1.5">Título</th>
                      <th className="px-2 py-1.5">Bairro</th>
                      <th className="px-2 py-1.5">Tipo</th>
                      <th className="px-2 py-1.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propertyItems.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-2 py-1.5 font-mono">{p.property_code}</td>
                        <td className="px-2 py-1.5 truncate max-w-[200px]">{p.title}</td>
                        <td className="px-2 py-1.5">{p.address_neighborhood}</td>
                        <td className="px-2 py-1.5">{p.property_type_name || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {p.transaction_type === "aluguel"
                            ? `R$ ${(p.rent_price ?? 0).toLocaleString("pt-BR")}/mês`
                            : `R$ ${(p.sale_price ?? 0).toLocaleString("pt-BR")}`}
                        </td>
                      </tr>
                    ))}
                    {propertyItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                          Nenhum imóvel ativo no catálogo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: "success" | "danger" | "muted" }) {
  const colorClass =
    highlight === "success" ? "border-primary/30 bg-primary/5"
    : highlight === "danger" ? "border-destructive/30 bg-destructive/5"
    : highlight === "muted" ? "border-muted bg-muted/30"
    : "border-border";
  return (
    <div className={`rounded-md border p-2 ${colorClass}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-xs font-semibold mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground min-w-[110px]">{k}:</span>
      <span className={`flex-1 break-all ${mono ? "font-mono text-[10px]" : ""}`}>{v}</span>
    </div>
  );
}
