import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Save } from "lucide-react";
import { useWhatsAppAgentConfig, type AgentConfig } from "@/hooks/useWhatsAppAgentConfig";

/**
 * Painel de personalização do Agente de IA.
 * Renderizado apenas quando o WhatsApp do agente estiver conectado.
 */
export function WhatsAppAgentPersonalization() {
  const { config, isLoading, saveConfig, isSaving } = useWhatsAppAgentConfig();
  const [form, setForm] = useState<Partial<AgentConfig>>({});

  useEffect(() => {
    if (config) {
      setForm({
        agent_name: config.agent_name,
        tone: config.tone,
        welcome_message: config.welcome_message,
        away_message: config.away_message,
        working_hours_start: config.working_hours_start,
        working_hours_end: config.working_hours_end,
        auto_qualify_leads: config.auto_qualify_leads,
        auto_create_leads: config.auto_create_leads,
        schedule_visits: config.schedule_visits,
        is_property_db_enabled: config.is_property_db_enabled,
      });
    }
  }, [config?.id]);

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => saveConfig(form);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold font-display">
              Personalização do Agente de IA
            </CardTitle>
            <CardDescription>
              Defina o nome, tom de voz e comportamentos do seu agente
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Identidade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent_name" className="text-xs">Nome do agente</Label>
            <Input
              id="agent_name"
              value={form.agent_name ?? ""}
              onChange={(e) => update("agent_name", e.target.value)}
              placeholder="Ex: Valentina"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Tom de voz</Label>
            <Select
              value={form.tone ?? "informal"}
              onValueChange={(v) => update("tone", v as AgentConfig["tone"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="informal">Informal</SelectItem>
                <SelectItem value="tecnico">Técnico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mensagens */}
        <div className="space-y-2">
          <Label htmlFor="welcome_message" className="text-xs">Mensagem de boas-vindas</Label>
          <Textarea
            id="welcome_message"
            value={form.welcome_message ?? ""}
            onChange={(e) => update("welcome_message", e.target.value)}
            rows={2}
            placeholder="Olá! Como posso ajudar?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="away_message" className="text-xs">Mensagem fora do horário</Label>
          <Textarea
            id="away_message"
            value={form.away_message ?? ""}
            onChange={(e) => update("away_message", e.target.value)}
            rows={2}
            placeholder="Estamos fora do horário de atendimento."
          />
        </div>

        {/* Horário */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Início do atendimento</Label>
            <Input
              type="time"
              value={form.working_hours_start ?? "08:00"}
              onChange={(e) => update("working_hours_start", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Fim do atendimento</Label>
            <Input
              type="time"
              value={form.working_hours_end ?? "18:00"}
              onChange={(e) => update("working_hours_end", e.target.value)}
            />
          </div>
        </div>

        {/* Comportamentos */}
        <div className="space-y-3 pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Comportamentos automáticos
          </p>

          <ToggleRow
            label="Qualificar leads automaticamente"
            description="O agente faz perguntas para entender intenção e orçamento"
            checked={!!form.auto_qualify_leads}
            onChange={(v) => update("auto_qualify_leads", v)}
          />
          <ToggleRow
            label="Criar leads no CRM"
            description="Novos contatos viram leads automaticamente"
            checked={!!form.auto_create_leads}
            onChange={(v) => update("auto_create_leads", v)}
          />
          <ToggleRow
            label="Agendar visitas"
            description="Permitir que o agente proponha horários"
            checked={!!form.schedule_visits}
            onChange={(v) => update("schedule_visits", v)}
          />
          <ToggleRow
            label="Catálogo de imóveis"
            description="Agente pode buscar e enviar imóveis do seu banco"
            checked={!!form.is_property_db_enabled}
            onChange={(v) => update("is_property_db_enabled", v)}
          />
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar personalização
        </Button>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
