import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Settings2 } from "lucide-react";
import { useRetellConfig, type RetellAgentConfig } from "@/hooks/useRetellConfig";

export function RetellConfigTab() {
  const { config, isLoading, hasConfig, saveConfig, isSaving } = useRetellConfig();
  const [form, setForm] = useState<Partial<RetellAgentConfig>>({});

  useEffect(() => {
    if (config) {
      setForm({
        agent_id: config.agent_id,
        agent_name: config.agent_name,
        qualification_prompt: config.qualification_prompt,
        transfer_keywords: config.transfer_keywords,
        max_call_duration_min: config.max_call_duration_min,
        working_hours_start: config.working_hours_start,
        working_hours_end: config.working_hours_end,
        auto_qualify_leads: config.auto_qualify_leads,
        auto_create_leads: config.auto_create_leads,
        enabled: config.enabled,
      });
    }
  }, [config]);

  const handleSave = () => saveConfig(form);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações do Agente de Voz
              </CardTitle>
              <CardDescription>
                O agente base (voz e LLM) é configurado no painel da Retell AI. Aqui você ajusta os parâmetros operacionais.
              </CardDescription>
            </div>
            <Badge variant={form.enabled ? "default" : "secondary"}>
              {form.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Ativar agente de voz</Label>
            <Switch
              id="enabled"
              checked={form.enabled ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>

          {/* Agent Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent_name">Nome do agente</Label>
              <Input
                id="agent_name"
                value={form.agent_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, agent_name: e.target.value }))}
                placeholder="Agente de Voz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent_id">Agent ID (Retell)</Label>
              <Input
                id="agent_id"
                value={form.agent_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))}
                placeholder="agent_xxxxx"
              />
              <p className="text-xs text-muted-foreground">Encontre no painel da Retell AI</p>
            </div>
          </div>

          {/* Qualification Prompt */}
          <div className="space-y-2">
            <Label htmlFor="qualification_prompt">Prompt de qualificação</Label>
            <Textarea
              id="qualification_prompt"
              value={form.qualification_prompt ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, qualification_prompt: e.target.value }))}
              placeholder="Instruções adicionais para qualificação de leads durante a chamada..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Este prompt é adicionado ao contexto da chamada para guiar a qualificação
            </p>
          </div>

          {/* Working Hours */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="working_hours_start">Horário início</Label>
              <Input
                id="working_hours_start"
                type="time"
                value={form.working_hours_start ?? "08:00"}
                onChange={(e) => setForm((f) => ({ ...f, working_hours_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="working_hours_end">Horário fim</Label>
              <Input
                id="working_hours_end"
                type="time"
                value={form.working_hours_end ?? "18:00"}
                onChange={(e) => setForm((f) => ({ ...f, working_hours_end: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_duration">Duração máx. (min)</Label>
              <Input
                id="max_duration"
                type="number"
                min={1}
                max={60}
                value={form.max_call_duration_min ?? 15}
                onChange={(e) => setForm((f) => ({ ...f, max_call_duration_min: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Transfer Keywords */}
          <div className="space-y-2">
            <Label htmlFor="transfer_keywords">Palavras-chave de transferência</Label>
            <Input
              id="transfer_keywords"
              value={(form.transfer_keywords ?? []).join(", ")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  transfer_keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                }))
              }
              placeholder="falar com corretor, atendente, humano"
            />
            <p className="text-xs text-muted-foreground">Separadas por vírgula</p>
          </div>

          {/* Auto flags */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Qualificar leads automaticamente</Label>
                <p className="text-xs text-muted-foreground">Classificar leads com base na chamada</p>
              </div>
              <Switch
                checked={form.auto_qualify_leads ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, auto_qualify_leads: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Criar leads no CRM automaticamente</Label>
                <p className="text-xs text-muted-foreground">Criar lead quando não existir no sistema</p>
              </div>
              <Switch
                checked={form.auto_create_leads ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, auto_create_leads: v }))}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
