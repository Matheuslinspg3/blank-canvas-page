
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Bot } from "lucide-react";
import { useWhatsAppAgentConfig, type AgentConfig } from "@/hooks/useWhatsAppAgentConfig";

export function AgentBehaviorTab() {
  const { config, isLoading, saveConfig, isSaving } = useWhatsAppAgentConfig();
  const [form, setForm] = useState<Partial<AgentConfig>>({});

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
      });
    }
  }, [config]);

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
            <Label>Prompt de Sistema</Label>
            <Textarea
              value={form.system_prompt ?? ""}
              onChange={(e) => update("system_prompt", e.target.value)}
              placeholder="Instrução base para a IA..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Instrução enviada como contexto para todas as respostas da IA.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horário e Mensagens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
