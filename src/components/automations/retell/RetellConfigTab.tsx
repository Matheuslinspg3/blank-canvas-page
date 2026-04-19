import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Settings2, Brain, Bell, Users, Webhook, PhoneOutgoing } from "lucide-react";
import { useRetellConfig, type RetellAgentConfig } from "@/hooks/useRetellConfig";
import { RetellTestPipelineButton } from "./RetellTestPipelineButton";

export function RetellConfigTab() {
  const { config, isLoading, hasConfig, saveConfig, isSaving } = useRetellConfig();
  const [form, setForm] = useState<Partial<RetellAgentConfig>>({});

  useEffect(() => {
    if (config) {
      setForm({ ...config });
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
                Configure qualificação, notificações e roteamento de leads por voz
              </CardDescription>
            </div>
            <Badge variant={form.enabled ? "default" : "secondary"}>
              {form.enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <Label htmlFor="enabled">Ativar agente de voz</Label>
            <Switch
              id="enabled"
              checked={form.enabled ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
          </div>

          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="bg-muted/50 w-full overflow-x-auto flex-nowrap">
              <TabsTrigger value="general" className="gap-1.5 shrink-0">
                <Settings2 className="h-3.5 w-3.5" /> Geral
              </TabsTrigger>
              <TabsTrigger value="qualification" className="gap-1.5 shrink-0">
                <Brain className="h-3.5 w-3.5" /> Qualificação
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5 shrink-0">
                <Bell className="h-3.5 w-3.5" /> Notificações
              </TabsTrigger>
              <TabsTrigger value="routing" className="gap-1.5 shrink-0">
                <Users className="h-3.5 w-3.5" /> Roteamento
              </TabsTrigger>
              <TabsTrigger value="integration" className="gap-1.5 shrink-0">
                <Webhook className="h-3.5 w-3.5" /> Integração
              </TabsTrigger>
              <TabsTrigger value="outbound" className="gap-1.5 shrink-0">
                <PhoneOutgoing className="h-3.5 w-3.5" /> Discagem Auto
              </TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4">
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
            </TabsContent>

            {/* Qualification Tab */}
            <TabsContent value="qualification" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Qualificar leads automaticamente</Label>
                    <p className="text-xs text-muted-foreground">IA analisa a transcrição e classifica o lead</p>
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
                  Adicionado ao contexto da chamada para guiar a qualificação
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="post_call_analysis_prompt">Prompt de análise pós-chamada</Label>
                <Textarea
                  id="post_call_analysis_prompt"
                  value={form.post_call_analysis_prompt ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, post_call_analysis_prompt: e.target.value }))}
                  placeholder="Analise a transcrição e extraia: nome, telefone, orçamento..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  A IA usa este prompt para extrair dados do lead da transcrição
                </p>
              </div>

              <div className="space-y-3">
                <Label>Critérios de pontuação (pesos)</Label>
                <p className="text-xs text-muted-foreground">Defina o peso de cada critério (total deve somar 100)</p>
                {Object.entries(form.score_criteria ?? {}).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <Input
                      value={key.replace(/_/g, " ")}
                      disabled
                      className="flex-1 capitalize"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={value as number}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          score_criteria: {
                            ...(f.score_criteria ?? {}),
                            [key]: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-20"
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification_template_broker">Template de notificação para o corretor</Label>
                <Textarea
                  id="notification_template_broker"
                  value={form.notification_template_broker ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notification_template_broker: e.target.value }))}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {"{{lead_name}}, {{lead_phone}}, {{score}}, {{summary}}, {{region}}, {{property_type}}"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notification_template_client">Template de notificação para o cliente</Label>
                <Textarea
                  id="notification_template_client"
                  value={form.notification_template_client ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notification_template_client: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Mensagem enviada ao cliente após a chamada
                </p>
              </div>
            </TabsContent>

            {/* Routing Tab */}
            <TabsContent value="routing" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="broker_assignment_mode">Modo de atribuição de corretor</Label>
                <Select
                  value={form.broker_assignment_mode ?? "round_robin"}
                  onValueChange={(v) => setForm((f) => ({ ...f, broker_assignment_mode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round-robin (distribuição equitativa)</SelectItem>
                    <SelectItem value="by_region">Por região de interesse</SelectItem>
                    <SelectItem value="by_availability">Por disponibilidade</SelectItem>
                    <SelectItem value="manual">Manual (sem atribuição automática)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define como o lead será atribuído a um corretor após a chamada
                </p>
              </div>
            </TabsContent>

            {/* Integration Tab */}
            <TabsContent value="integration" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="n8n_webhook_url">URL do Webhook n8n</Label>
                <Input
                  id="n8n_webhook_url"
                  value={form.n8n_webhook_url ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, n8n_webhook_url: e.target.value }))}
                  placeholder="https://seu-n8n.com/webhook/retell-voice"
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Quando preenchido, um webhook é disparado após cada chamada para orquestração no n8n
                </p>
              </div>
            </TabsContent>

            {/* Outbound Tab */}
            <TabsContent value="outbound" className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                ⚠️ A discagem automática só ocorre se o lead tiver telefone, opt-in (consent_voice_call=true) e estiver dentro do horário comercial.
              </div>

              <div className="flex justify-end">
                <RetellTestPipelineButton />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Ativar discagem automática</Label>
                  <p className="text-xs text-muted-foreground">Liga para o lead recém-cadastrado automaticamente</p>
                </div>
                <Switch
                  checked={form.auto_outbound_enabled ?? false}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, auto_outbound_enabled: v }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retell_from_number">Número de origem (E.164)</Label>
                  <Input
                    id="retell_from_number"
                    value={form.retell_from_number ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, retell_from_number: e.target.value }))}
                    placeholder="+551130000000"
                  />
                  <p className="text-xs text-muted-foreground">Número comprado no painel da Retell</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retell_phone_number_id">Phone Number ID (opcional)</Label>
                  <Input
                    id="retell_phone_number_id"
                    value={form.retell_phone_number_id ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, retell_phone_number_id: e.target.value }))}
                    placeholder="phn_xxxxx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_call_attempts">Máx. tentativas</Label>
                  <Input
                    id="max_call_attempts"
                    type="number"
                    min={1}
                    max={10}
                    value={form.max_call_attempts ?? 3}
                    onChange={(e) => setForm((f) => ({ ...f, max_call_attempts: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_between">Min. minutos entre tentativas</Label>
                  <Input
                    id="min_between"
                    type="number"
                    min={5}
                    value={form.min_minutes_between_attempts ?? 30}
                    onChange={(e) => setForm((f) => ({ ...f, min_minutes_between_attempts: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
