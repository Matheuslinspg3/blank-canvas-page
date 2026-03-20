import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Zap } from "lucide-react";
import { useLeadStages } from "@/hooks/useLeadStages";

interface CrmAutomationCardProps {
  autoSend: boolean;
  onAutoSendChange: (val: boolean) => void;
  stageId: string;
  onStageIdChange: (val: string) => void;
  defaultSource?: string;
  onDefaultSourceChange?: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
  showSource?: boolean;
}

export default function CrmAutomationCard({
  autoSend,
  onAutoSendChange,
  stageId,
  onStageIdChange,
  defaultSource,
  onDefaultSourceChange,
  onSave,
  isSaving,
  showSource = false,
}: CrmAutomationCardProps) {
  const { leadStages } = useLeadStages();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Automação CRM
        </CardTitle>
        <CardDescription>
          Configure o envio automático de leads para o CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch checked={autoSend} onCheckedChange={onAutoSendChange} />
          <Label>Encaminhar automaticamente leads ao CRM</Label>
        </div>

        {autoSend && (
          <div className="space-y-4 pl-1">
            <div className="space-y-2 max-w-sm">
              <Label>Estágio inicial do CRM</Label>
              <Select value={stageId} onValueChange={onStageIdChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um estágio..." />
                </SelectTrigger>
                <SelectContent>
                  {leadStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showSource && onDefaultSourceChange && (
              <div className="space-y-2 max-w-sm">
                <Label>Origem do lead</Label>
                <Input
                  value={defaultSource || ""}
                  onChange={(e) => onDefaultSourceChange(e.target.value)}
                  placeholder="RD Station"
                />
              </div>
            )}
          </div>
        )}

        <Button onClick={onSave} disabled={isSaving} size="sm">
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Automação
        </Button>
      </CardContent>
    </Card>
  );
}
