import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, UserCheck, CalendarCheck, Check } from "lucide-react";
import { useQualificationConfig, DEFAULT_SCORE_CRITERIA } from "@/hooks/useQualificationConfig";
import type { ScoreCriterion, TemperatureThresholds } from "@/hooks/useQualificationConfig";
import { ScoreTemperatureCard } from "./ScoreTemperatureCard";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

const REQUIRED_FIELD_OPTIONS = [
  { value: "nome", label: "Nome" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "regiao", label: "Região de interesse" },
  { value: "orcamento", label: "Faixa de orçamento" },
  { value: "tipo_imovel", label: "Tipo de imóvel" },
  { value: "finalidade", label: "Finalidade" },
  { value: "prazo_compra", label: "Prazo para compra" },
];

const BROKER_MODES = [
  { value: "manual", label: "Manual", description: "Administrador atribui manualmente" },
  { value: "round_robin", label: "Round-robin", description: "Distribui sequencialmente entre corretores ativos" },
  { value: "by_region", label: "Por região", description: "Atribui baseado na região de interesse do lead" },
  { value: "by_availability", label: "Por disponibilidade", description: "Atribui ao corretor online no momento" },
  { value: "by_score", label: "Automática por score", description: "Leads quentes vão para os top corretores" },
];

export function AgentQualificationTab() {
  const { config, saveConfig, isSaving, isLoading } = useQualificationConfig();
  const [form, setForm] = useState({
    auto_qualify_leads: false,
    auto_create_leads: false,
    schedule_visits: false,
    broker_assignment_mode: "manual",
    required_fields: ["nome", "telefone", "email"] as string[],
    scheduling_days: ["seg", "ter", "qua", "qui", "sex"] as string[],
    scheduling_hour_start: "09:00",
    scheduling_hour_end: "17:00",
    prompt_qualify_leads: "",
    prompt_create_leads: "",
    prompt_schedule_visits: "",
  });

  useEffect(() => {
    if (config) {
      setForm({
        auto_qualify_leads: config.auto_qualify_leads,
        auto_create_leads: config.auto_create_leads,
        schedule_visits: config.schedule_visits,
        broker_assignment_mode: config.broker_assignment_mode ?? "manual",
        required_fields: config.required_fields ?? ["nome", "telefone", "email"],
        scheduling_days: config.scheduling_days ?? ["seg", "ter", "qua", "qui", "sex"],
        scheduling_hour_start: config.scheduling_hour_start ?? "09:00",
        scheduling_hour_end: config.scheduling_hour_end ?? "17:00",
        prompt_qualify_leads: config.prompt_qualify_leads ?? "",
        prompt_create_leads: config.prompt_create_leads ?? "",
        prompt_schedule_visits: config.prompt_schedule_visits ?? "",
      });
    }
  }, [config]);

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      scheduling_days: f.scheduling_days.includes(day)
        ? f.scheduling_days.filter((d) => d !== day)
        : [...f.scheduling_days, day],
    }));
  };

  const toggleField = (field: string) => {
    setForm((f) => ({
      ...f,
      required_fields: f.required_fields.includes(field)
        ? f.required_fields.filter((rf) => rf !== field)
        : [...f.required_fields, field],
    }));
  };

  const selectedBrokerMode = BROKER_MODES.find((m) => m.value === form.broker_assignment_mode);

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" /> Qualificação de Leads
          </CardTitle>
          <CardDescription>
            Configure como a IA qualifica e registra leads automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Auto-qualify toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-qualificação</Label>
                <p className="text-xs text-muted-foreground">
                  A IA pergunta nome, telefone, e-mail e interesse automaticamente.
                </p>
              </div>
              <Switch
                checked={form.auto_qualify_leads}
                onCheckedChange={(v) => setForm((f) => ({ ...f, auto_qualify_leads: v }))}
              />
            </div>
            {form.auto_qualify_leads && (
              <div className="pl-4 border-l-2 border-primary/30">
                <Label className="text-sm">Prompt de qualificação</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  value={form.prompt_qualify_leads}
                  onChange={(e) => setForm((f) => ({ ...f, prompt_qualify_leads: e.target.value }))}
                  placeholder="Instrução para a IA qualificar leads..."
                />
              </div>
            )}
          </div>

          {/* Auto-create leads toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Criar lead no CRM</Label>
                <p className="text-xs text-muted-foreground">
                  Ao capturar dados, criar lead automaticamente no CRM.
                </p>
              </div>
              <Switch
                checked={form.auto_create_leads}
                onCheckedChange={(v) => setForm((f) => ({ ...f, auto_create_leads: v }))}
              />
            </div>
            {form.auto_create_leads && (
              <div className="pl-4 border-l-2 border-primary/30">
                <Label className="text-sm">Prompt de criação de lead</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  value={form.prompt_create_leads}
                  onChange={(e) => setForm((f) => ({ ...f, prompt_create_leads: e.target.value }))}
                  placeholder="Instrução para a IA criar leads no CRM..."
                />
              </div>
            )}
          </div>

          {/* Required fields chips */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <Label>Campos obrigatórios</Label>
              <p className="text-xs text-muted-foreground">
                Dados que a IA deve coletar antes de considerar o lead qualificado
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_FIELD_OPTIONS.map((field) => {
                const active = form.required_fields.includes(field.value);
                return (
                  <button
                    key={field.value}
                    type="button"
                    onClick={() => toggleField(field.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border cursor-pointer",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Broker assignment mode */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label>Atribuição de Corretor</Label>
            <Select
              value={form.broker_assignment_mode}
              onValueChange={(v) => setForm((f) => ({ ...f, broker_assignment_mode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BROKER_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBrokerMode && (
              <p className="text-xs text-muted-foreground">{selectedBrokerMode.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scheduling card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4" /> Agendamento de Visitas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir agendamento de visitas</Label>
                <p className="text-xs text-muted-foreground">
                  A IA poderá agendar visitas diretamente na agenda do corretor.
                </p>
              </div>
              <Switch
                checked={form.schedule_visits}
                onCheckedChange={(v) => setForm((f) => ({ ...f, schedule_visits: v }))}
              />
            </div>
            {form.schedule_visits && (
              <div className="pl-4 border-l-2 border-primary/30">
                <Label className="text-sm">Prompt de agendamento</Label>
                <Textarea
                  className="mt-1 min-h-[80px]"
                  value={form.prompt_schedule_visits}
                  onChange={(e) => setForm((f) => ({ ...f, prompt_schedule_visits: e.target.value }))}
                  placeholder="Instrução para a IA agendar visitas..."
                />
              </div>
            )}
          </div>

          {form.schedule_visits && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label className="text-sm">Dias disponíveis</Label>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((day) => (
                    <label key={day.value} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={form.scheduling_days.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Horário início</Label>
                  <Input
                    type="time"
                    value={form.scheduling_hour_start}
                    onChange={(e) => setForm((f) => ({ ...f, scheduling_hour_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Horário fim</Label>
                  <Input
                    type="time"
                    value={form.scheduling_hour_end}
                    onChange={(e) => setForm((f) => ({ ...f, scheduling_hour_end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveConfig(form)} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Qualificação"}
        </Button>
      </div>
    </div>
  );
}
