import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BarChart3, Flame, Thermometer, Snowflake } from "lucide-react";
import type { ScoreCriterion, TemperatureThresholds } from "@/hooks/useQualificationConfig";

interface Props {
  autoScoring: boolean;
  onAutoScoringChange: (v: boolean) => void;
  criteria: ScoreCriterion[];
  onCriteriaChange: (criteria: ScoreCriterion[]) => void;
  thresholds: TemperatureThresholds;
  onThresholdsChange: (t: TemperatureThresholds) => void;
}

export function ScoreTemperatureCard({
  autoScoring,
  onAutoScoringChange,
  criteria,
  onCriteriaChange,
  thresholds,
  onThresholdsChange,
}: Props) {
  const toggleCriterion = (key: string) => {
    onCriteriaChange(
      criteria.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const setWeight = (key: string, weight: number) => {
    onCriteriaChange(
      criteria.map((c) => (c.key === key ? { ...c, weight: Math.min(100, Math.max(0, weight)) } : c))
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" /> Score e Temperatura
        </CardTitle>
        <CardDescription>
          Configure como o score de qualificação é calculado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Auto-scoring toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Scoring automático</Label>
            <p className="text-xs text-muted-foreground">
              Calcular score de qualificação automaticamente com base nos critérios abaixo
            </p>
          </div>
          <Switch checked={autoScoring} onCheckedChange={onAutoScoringChange} />
        </div>

        {/* Criteria list */}
        <div className={`space-y-2 ${!autoScoring ? "opacity-50 pointer-events-none" : ""}`}>
          <Label className="text-sm">Critérios de pontuação</Label>
          {criteria.map((c) => (
            <div key={c.key} className="flex items-center gap-3">
              <Switch
                checked={c.enabled}
                onCheckedChange={() => toggleCriterion(c.key)}
                className="shrink-0"
              />
              <span className="flex-1 text-sm">{c.label}</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) => setWeight(c.key, parseInt(e.target.value) || 0)}
                className="w-16 h-9 text-center"
                disabled={!c.enabled}
              />
              <span className="text-xs text-muted-foreground w-6">pts</span>
            </div>
          ))}
        </div>

        {/* Temperature thresholds */}
        <div className={`space-y-3 pt-3 border-t border-border ${!autoScoring ? "opacity-50 pointer-events-none" : ""}`}>
          <Label className="text-sm">Faixas de temperatura</Label>
          <div className="grid grid-cols-3 gap-3">
            {/* Cold */}
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <Snowflake className="h-4 w-4 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Frio</p>
                <p className="text-xs text-muted-foreground">0 até</p>
              </div>
              <Input
                type="number"
                min={1}
                max={98}
                value={thresholds.cold_max}
                onChange={(e) => {
                  const v = Math.min(98, Math.max(1, parseInt(e.target.value) || 1));
                  onThresholdsChange({
                    cold_max: v,
                    warm_max: Math.max(v + 1, thresholds.warm_max),
                  });
                }}
                className="w-14 h-8 text-center text-xs"
              />
            </div>
            {/* Warm */}
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <Thermometer className="h-4 w-4 text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Morno</p>
                <p className="text-xs text-muted-foreground">{thresholds.cold_max + 1} até</p>
              </div>
              <Input
                type="number"
                min={thresholds.cold_max + 1}
                max={99}
                value={thresholds.warm_max}
                onChange={(e) => {
                  const v = Math.min(99, Math.max(thresholds.cold_max + 1, parseInt(e.target.value) || thresholds.cold_max + 1));
                  onThresholdsChange({ ...thresholds, warm_max: v });
                }}
                className="w-14 h-8 text-center text-xs"
              />
            </div>
            {/* Hot */}
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <Flame className="h-4 w-4 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">Quente</p>
                <p className="text-xs text-muted-foreground">{thresholds.warm_max + 1} até 100</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
