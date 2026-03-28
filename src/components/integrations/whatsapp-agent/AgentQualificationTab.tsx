
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, UserCheck, CalendarCheck } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";

const DAYS = [
  { value: "seg", label: "Seg" },
  { value: "ter", label: "Ter" },
  { value: "qua", label: "Qua" },
  { value: "qui", label: "Qui" },
  { value: "sex", label: "Sex" },
  { value: "sab", label: "Sáb" },
  { value: "dom", label: "Dom" },
];

export function AgentQualificationTab() {
  const { config, saveConfig, isSaving, isLoading } = useWhatsAppAgentConfig();
  const [form, setForm] = useState({
    auto_qualify_leads: false,
    auto_create_leads: false,
    schedule_visits: false,
    broker_assignment_mode: "manual",
    scheduling_days: ["seg", "ter", "qua", "qui", "sex"] as string[],
    scheduling_hour_start: "09:00",
    scheduling_hour_end: "17:00",
  });

  useEffect(() => {
    if (config) {
      setForm({
        auto_qualify_leads: config.auto_qualify_leads,
        auto_create_leads: config.auto_create_leads,
        schedule_visits: config.schedule_visits,
        broker_assignment_mode: config.broker_assignment_mode ?? "manual",
        scheduling_days: config.scheduling_days ?? ["seg", "ter", "qua", "qui", "sex"],
        scheduling_hour_start: config.scheduling_hour_start ?? "09:00",
        scheduling_hour_end: config.scheduling_hour_end ?? "17:00",
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

          <div className="space-y-2">
            <Label>Atribuição de Corretor</Label>
            <Select
              value={form.broker_assignment_mode}
              onValueChange={(v) => setForm((f) => ({ ...f, broker_assignment_mode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="round_robin">Round-robin</SelectItem>
                <SelectItem value="by_region">Por região</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4" /> Agendamento de Visitas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="space-y-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label className="text-sm">Dias disponíveis</Label>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
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
