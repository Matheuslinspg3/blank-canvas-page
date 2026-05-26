import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Sparkles, Save, X, Plus, Mic, UserRound, CalendarClock, MessageSquare, Clock, Wand2 } from "lucide-react";
import { useWhatsAppAgentConfig, type AgentConfig } from "@/hooks/useWhatsAppAgentConfig";

const WEEKDAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

const VOICE_PRESETS = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (feminina natural)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura (feminina jovem)" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (feminina suave)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (masculina firme)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (masculina madura)" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris (masculina jovem)" },
];

export function WhatsAppAgentPersonalization() {
  const { config, isLoading, saveConfig, isSaving } = useWhatsAppAgentConfig();
  const [form, setForm] = useState<Partial<AgentConfig>>({});
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    if (config) setForm({ ...config });
  }, [config?.id]);

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) => {
    const current = form.scheduling_days ?? [];
    update("scheduling_days", current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  };

  const addKeyword = () => {
    const k = newKeyword.trim().toLowerCase();
    if (!k) return;
    const current = form.transfer_keywords ?? [];
    if (current.includes(k)) return;
    update("transfer_keywords", [...current, k]);
    setNewKeyword("");
  };

  const removeKeyword = (k: string) =>
    update("transfer_keywords", (form.transfer_keywords ?? []).filter((x) => x !== k));

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
              Defina identidade, comportamentos, voz, transferência humana e prompts customizados
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

        {/* Mensagens base */}
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

        {/* Horário de atendimento */}
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
          <ToggleRow label="Qualificar leads automaticamente" description="O agente faz perguntas para entender intenção e orçamento" checked={!!form.auto_qualify_leads} onChange={(v) => update("auto_qualify_leads", v)} />
          <ToggleRow label="Criar leads no CRM" description="Novos contatos viram leads automaticamente" checked={!!form.auto_create_leads} onChange={(v) => update("auto_create_leads", v)} />
          <ToggleRow label="Agendar visitas" description="Permitir que o agente proponha horários" checked={!!form.schedule_visits} onChange={(v) => update("schedule_visits", v)} />
          <ToggleRow label="Catálogo de imóveis" description="Agente pode buscar e enviar imóveis do seu banco" checked={!!form.is_property_db_enabled} onChange={(v) => update("is_property_db_enabled", v)} />
        </div>

        {/* Avançado */}
        <Accordion type="multiple" className="border-t pt-2">
          {/* Voz */}
          <AccordionItem value="voice">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /> Respostas em áudio (ElevenLabs)</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <ToggleRow
                label="Habilitar voz"
                description="Permite que o agente responda em áudio quando marcado com #VOZAI"
                checked={!!form.voice_enabled}
                onChange={(v) => update("voice_enabled", v)}
              />
              <div className="space-y-2">
                <Label className="text-xs">Voz</Label>
                <Select value={form.voice_id ?? VOICE_PRESETS[0].id} onValueChange={(v) => update("voice_id", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_PRESETS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Probabilidade de resposta em áudio</Label>
                  <span className="text-xs font-mono text-muted-foreground">{form.voice_percentage ?? 0}%</span>
                </div>
                <Slider
                  value={[form.voice_percentage ?? 0]}
                  onValueChange={([v]) => update("voice_percentage", v)}
                  min={0} max={100} step={5}
                />
                <p className="text-[10px] text-muted-foreground">0% = só quando solicitado; 100% = sempre que possível</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Transferência */}
          <AccordionItem value="transfer">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /> Transferência para humano</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Palavras-chave que disparam transferência</Label>
                <div className="flex flex-wrap gap-1.5 min-h-[34px] p-2 rounded-md border bg-muted/30">
                  {(form.transfer_keywords ?? []).map((k) => (
                    <Badge key={k} variant="secondary" className="gap-1">
                      {k}
                      <button onClick={() => removeKeyword(k)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {(form.transfer_keywords ?? []).length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhuma palavra-chave</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                    placeholder="ex: falar com corretor"
                    className="h-9"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addKeyword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Máx. mensagens antes de transferir</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.max_messages_before_transfer ?? 10}
                    onChange={(e) => update("max_messages_before_transfer", Number(e.target.value) || 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Modo de atribuição de corretor</Label>
                  <Select
                    value={form.broker_assignment_mode ?? "manual"}
                    onValueChange={(v) => update("broker_assignment_mode", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="round_robin">Rotativo (round-robin)</SelectItem>
                      <SelectItem value="random">Aleatório</SelectItem>
                      <SelectItem value="least_busy">Menos ocupado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Telefone do corretor para handoff</Label>
                <Input
                  value={form.transfer_phone ?? ""}
                  onChange={(e) => update("transfer_phone", e.target.value)}
                  placeholder="5511999999999"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mensagem de transferência</Label>
                <Textarea
                  rows={2}
                  value={form.transfer_message ?? ""}
                  onChange={(e) => update("transfer_message", e.target.value)}
                  placeholder="Vou conectar você com um especialista agora 👨‍💼"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Agendamento */}
          <AccordionItem value="scheduling">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Janela de agendamento de visitas</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Dias disponíveis</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const active = (form.scheduling_days ?? []).includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/40"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Início (visitas)</Label>
                  <Input type="time" value={form.scheduling_hour_start ?? "09:00"} onChange={(e) => update("scheduling_hour_start", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Fim (visitas)</Label>
                  <Input type="time" value={form.scheduling_hour_end ?? "17:00"} onChange={(e) => update("scheduling_hour_end", e.target.value)} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Timing das boas-vindas */}
          <AccordionItem value="timing">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Timing humano e A/B test</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Delay mín. (segundos)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={form.welcome_delay_min ?? 3}
                    onChange={(e) => update("welcome_delay_min", Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Delay máx. (segundos)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={form.welcome_delay_max ?? 8}
                    onChange={(e) => update("welcome_delay_max", Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <ToggleRow
                label="A/B test de boas-vindas"
                description="Alterna mensagens cadastradas para medir performance"
                checked={!!form.welcome_ab_test}
                onChange={(v) => update("welcome_ab_test", v)}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Prompts customizados */}
          <AccordionItem value="prompts">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Prompts customizados (avançado)</div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-2"><MessageSquare className="h-3 w-3" /> Instruções gerais (system prompt)</Label>
                <Textarea
                  rows={4}
                  value={form.system_prompt ?? ""}
                  onChange={(e) => update("system_prompt", e.target.value)}
                  placeholder="Você é a Valentina, da imobiliária X. Sempre seja gentil..."
                />
              </div>
              <PromptField label="Qualificação de leads" value={form.prompt_qualify_leads} onChange={(v) => update("prompt_qualify_leads", v)} placeholder="Pergunte intenção, orçamento, prazo e região..." />
              <PromptField label="Criação de leads" value={form.prompt_create_leads} onChange={(v) => update("prompt_create_leads", v)} placeholder="Confirme nome e telefone antes de salvar..." />
              <PromptField label="Agendamento de visitas" value={form.prompt_schedule_visits} onChange={(v) => update("prompt_schedule_visits", v)} placeholder="Proponha 2 horários antes de confirmar..." />
              <PromptField label="Busca no catálogo" value={form.prompt_property_db} onChange={(v) => update("prompt_property_db", v)} placeholder="Apresente no máximo 3 imóveis por vez..." />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar personalização
        </Button>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label, description, checked, onChange,
}: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
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

function PromptField({
  label, value, onChange, placeholder,
}: { label: string; value: string | null | undefined; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
