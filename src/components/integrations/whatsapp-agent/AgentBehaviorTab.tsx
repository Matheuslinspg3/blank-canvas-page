
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Save, Bot, Eye, Volume2 } from "lucide-react";
import { useWhatsAppAgentConfig, type AgentConfig } from "@/hooks/useWhatsAppAgentConfig";

const DAY_LABELS: Record<string, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
  sex: "Sexta", sab: "Sábado", dom: "Domingo",
};

function buildComposedPrompt(form: Partial<AgentConfig>): string {
  const parts: string[] = [];

  if (form.system_prompt?.trim()) {
    parts.push(form.system_prompt.trim());
  }

  parts.push("\n--- Instruções ---");

  if (form.auto_qualify_leads) {
    parts.push(`• ${form.prompt_qualify_leads || "Ao iniciar uma conversa, colete nome completo, telefone, e-mail e interesse do cliente de forma natural."}`);
  } else {
    parts.push("• Não é necessário a coleta de dados como nome completo, telefone, e-mail e interesse do cliente.");
  }

  if (form.auto_create_leads) {
    parts.push(`• ${form.prompt_create_leads || "Após coletar os dados do cliente, registre automaticamente como lead no CRM."}`);
  } else {
    parts.push("• Não registre leads automaticamente no CRM. Apenas converse normalmente.");
  }

  if (form.schedule_visits) {
    const days = (form.scheduling_days ?? []).map((d) => DAY_LABELS[d] ?? d).join(", ");
    const start = form.scheduling_hour_start ?? "09:00";
    const end = form.scheduling_hour_end ?? "17:00";
    const custom = form.prompt_schedule_visits?.trim();
    parts.push(custom
      ? `• ${custom} Horários: ${days} das ${start} às ${end}.`
      : `• Você pode agendar visitas. Horários disponíveis: ${days} das ${start} às ${end}. Confirme data e horário com o cliente antes de registrar.`);
  } else {
    parts.push("• Não ofereça ou agende visitas a imóveis. Caso o cliente solicite, oriente-o a entrar em contato diretamente com a imobiliária.");
  }

  if (form.is_property_db_enabled) {
    parts.push(`• ${form.prompt_property_db || "Você tem acesso ao banco de imóveis da imobiliária. Use-o para recomendar imóveis relevantes."}`);
  } else {
    parts.push("• Você não tem acesso ao banco de imóveis. Caso o cliente pergunte sobre imóveis específicos, oriente-o a consultar o site ou falar com um corretor.");
  }

  return parts.join("\n");
}

export function AgentBehaviorTab() {
  const { config, isLoading, saveConfig, isSaving } = useWhatsAppAgentConfig();
  const [form, setForm] = useState<Partial<AgentConfig>>({});
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        agent_name: config.agent_name,
        tone: config.tone,
        system_prompt: config.system_prompt,
        working_hours_start: config.working_hours_start,
        working_hours_end: config.working_hours_end,
        welcome_message: config.welcome_message,
        away_message: config.away_message,
        auto_qualify_leads: config.auto_qualify_leads,
        auto_create_leads: config.auto_create_leads,
        schedule_visits: config.schedule_visits,
        is_property_db_enabled: config.is_property_db_enabled,
        scheduling_days: config.scheduling_days,
        scheduling_hour_start: config.scheduling_hour_start,
        scheduling_hour_end: config.scheduling_hour_end,
        prompt_qualify_leads: config.prompt_qualify_leads,
        prompt_create_leads: config.prompt_create_leads,
        prompt_schedule_visits: config.prompt_schedule_visits,
        prompt_property_db: config.prompt_property_db,
        voice_enabled: config.voice_enabled,
        voice_percentage: config.voice_percentage,
        voice_id: config.voice_id,
      });
    }
  }, [config]);

  const composedPrompt = useMemo(() => buildComposedPrompt(form), [form]);

  const update = (key: keyof AgentConfig, value: any) => setForm((f) => ({ ...f, [key]: value }));

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Personalidade do Agente
          </CardTitle>
          <CardDescription>Configure como a Valentina se comporta nas conversas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input
                value={form.agent_name ?? ""}
                onChange={(e) => update("agent_name", e.target.value)}
                placeholder="Valentina"
              />
            </div>
            <div className="space-y-2">
              <Label>Tom de Voz</Label>
              <Select value={form.tone ?? "informal"} onValueChange={(v) => update("tone", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="informal">Informal</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prompt de Sistema (Base)</Label>
            <Textarea
              value={form.system_prompt ?? ""}
              onChange={(e) => update("system_prompt", e.target.value)}
              placeholder="Instrução base para a IA..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Instrução base. As regras ativas (qualificação, agendamento, imóveis) serão adicionadas automaticamente.
            </p>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? "Ocultar Preview" : "Preview do Prompt Final"}
            </Button>
            {showPreview && (
              <div className="rounded-md border border-border bg-muted/50 p-3 max-h-64 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono">
                  {composedPrompt || "(Prompt vazio — configure o prompt base e ative funcionalidades)"}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horário e Mensagens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início do Atendimento</Label>
              <Input
                type="time"
                value={form.working_hours_start ?? "08:00"}
                onChange={(e) => update("working_hours_start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim do Atendimento</Label>
              <Input
                type="time"
                value={form.working_hours_end ?? "18:00"}
                onChange={(e) => update("working_hours_end", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mensagem de Boas-vindas</Label>
            <Textarea
              value={form.welcome_message ?? ""}
              onChange={(e) => update("welcome_message", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Mensagem de Ausência</Label>
            <Textarea
              value={form.away_message ?? ""}
              onChange={(e) => update("away_message", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveConfig(form)} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Comportamento"}
        </Button>
      </div>
    </div>
  );
}
