import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Settings2, MessageCircle, RotateCcw } from "lucide-react";
import { useBrokerAutomation } from "@/hooks/whatsapp/useBrokerAutomation";
import { useBrokerTemplates } from "@/hooks/whatsapp/useBrokerTemplates";

export function BrokerAutomationCard() {
  const { config, isLoading, update, isSaving, channelId } = useBrokerAutomation();
  const { templates: greetingTemplates } = useBrokerTemplates("saudacao");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!channelId) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Conecte seu WhatsApp primeiro para configurar automações.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cfg = config!;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Automações
        </CardTitle>
        <CardDescription>Saudação automática e follow-up sem IA</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Greeting */}
        <div className="space-y-3 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <Label className="font-medium">Saudação automática</Label>
            </div>
            <Switch
              checked={cfg.greeting_enabled}
              disabled={isSaving}
              onCheckedChange={(v) => update({ greeting_enabled: v })}
            />
          </div>
          {cfg.greeting_enabled && (
            <div className="space-y-2 pl-6">
              <Label className="text-xs text-muted-foreground">Template de saudação</Label>
              {greetingTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Crie um template com categoria "Saudação" primeiro.
                </p>
              ) : (
                <Select
                  value={cfg.greeting_template_id ?? ""}
                  onValueChange={(v) => update({ greeting_template_id: v || null })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {greetingTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        {/* Follow-up */}
        <div className="space-y-3 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              <Label className="font-medium">Follow-up individual</Label>
            </div>
            <Switch
              checked={cfg.followup_enabled}
              disabled={isSaving}
              onCheckedChange={(v) => update({ followup_enabled: v })}
            />
          </div>
          {cfg.followup_enabled && (
            <div className="space-y-3 pl-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tentativas máximas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="h-8 text-sm"
                    value={cfg.followup_max_attempts}
                    onChange={(e) => update({ followup_max_attempts: Number(e.target.value) || 3 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Intervalos (horas)</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="24, 48, 72"
                    value={(cfg.followup_intervals ?? []).join(", ")}
                    onChange={(e) => {
                      const vals = e.target.value.split(",").map((v) => Number(v.trim())).filter(Boolean);
                      if (vals.length > 0) update({ followup_intervals: vals });
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Início expediente</Label>
                  <Input
                    type="time"
                    className="h-8 text-sm"
                    value={cfg.followup_business_hours?.start ?? "08:00"}
                    onChange={(e) =>
                      update({
                        followup_business_hours: {
                          ...cfg.followup_business_hours,
                          start: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fim expediente</Label>
                  <Input
                    type="time"
                    className="h-8 text-sm"
                    value={cfg.followup_business_hours?.end ?? "18:00"}
                    onChange={(e) =>
                      update({
                        followup_business_hours: {
                          ...cfg.followup_business_hours,
                          end: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Crie templates com categoria "Follow-up" para serem usados nas tentativas.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
