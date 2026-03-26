
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, Star, ShieldOff, ShieldCheck, Search, Save } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { useWhatsAppPropertyRules, type RuleType } from "@/hooks/useWhatsAppPropertyRules";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function PropertySelector({
  onAdd,
  isAdding,
  existingIds,
}: {
  onAdd: (id: string, type: RuleType) => void;
  isAdding: boolean;
  existingIds: Set<string>;
}) {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("highlight");

  const { data: properties = [] } = useQuery({
    queryKey: ["properties-selector", profile?.organization_id, search],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let q = supabase
        .from("properties")
        .select("id, title, property_code, address_neighborhood, address_city")
        .eq("organization_id", profile.organization_id)
        .eq("status", "disponivel")
        .limit(20);
      if (search) {
        q = q.or(`title.ilike.%${search}%,property_code.ilike.%${search}%,address_neighborhood.ilike.%${search}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!profile?.organization_id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" /> Adicionar Regra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar imóvel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="highlight">⭐ Destaque</SelectItem>
              <SelectItem value="whitelist">✅ Whitelist</SelectItem>
              <SelectItem value="blacklist">🚫 Blacklist</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {properties.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"
            >
              <div>
                <span className="font-medium">{p.property_code}</span>
                <span className="text-muted-foreground ml-2">{p.title}</span>
                {p.address_neighborhood && (
                  <span className="text-muted-foreground text-xs ml-1">• {p.address_neighborhood}</span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isAdding || existingIds.has(`${p.id}-${ruleType}`)}
                onClick={() => onAdd(p.id, ruleType)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {properties.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum imóvel encontrado</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const RULE_META: Record<RuleType, { label: string; icon: React.ElementType; color: string }> = {
  highlight: { label: "Destaque", icon: Star, color: "text-yellow-500" },
  whitelist: { label: "Whitelist", icon: ShieldCheck, color: "text-green-500" },
  blacklist: { label: "Blacklist", icon: ShieldOff, color: "text-destructive" },
};

export function AgentPropertiesTab() {
  const { config, saveConfig, isSaving } = useWhatsAppAgentConfig();
  const { rules, whitelist, blacklist, highlights, addRule, removeRule, isAdding, isRemoving } =
    useWhatsAppPropertyRules();
  const { profile } = useAuth();

  const existingIds = new Set(rules.map((r) => `${r.property_id}-${r.rule_type}`));

  // Fetch property titles for display
  const propertyIds = rules.map((r) => r.property_id);
  const { data: propertyMap = {} } = useQuery({
    queryKey: ["property-names", propertyIds],
    queryFn: async () => {
      if (!propertyIds.length) return {};
      const { data } = await supabase
        .from("properties")
        .select("id, title, property_code")
        .in("id", propertyIds);
      const map: Record<string, { title: string; code: string }> = {};
      data?.forEach((p) => {
        map[p.id] = { title: p.title ?? "", code: p.property_code ?? "" };
      });
      return map;
    },
    enabled: propertyIds.length > 0,
  });

  const renderRuleList = (items: typeof rules, type: RuleType) => {
    const meta = RULE_META[type];
    const Icon = meta.icon;
    if (!items.length) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className={`h-4 w-4 ${meta.color}`} /> {meta.label} ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {items.map((rule) => {
              const prop = propertyMap[rule.property_id];
              return (
                <div key={rule.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                  <span>
                    <span className="font-medium">{prop?.code ?? "..."}</span>{" "}
                    <span className="text-muted-foreground">{prop?.title ?? ""}</span>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={isRemoving}
                    onClick={() => removeRule(rule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Banco de Imóveis
          </CardTitle>
          <CardDescription>
            Configure quais imóveis a IA pode apresentar aos clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Habilitar acesso ao banco de imóveis</Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, a IA consulta seus imóveis para recomendar ao cliente.
              </p>
            </div>
            <Switch
              checked={config.is_property_db_enabled}
              onCheckedChange={(v) => saveConfig({ is_property_db_enabled: v })}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {config.is_property_db_enabled && (
        <>
          <PropertySelector
            onAdd={(id, type) => addRule(id, type)}
            isAdding={isAdding}
            existingIds={existingIds}
          />
          {renderRuleList(highlights, "highlight")}
          {renderRuleList(whitelist, "whitelist")}
          {renderRuleList(blacklist, "blacklist")}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sem regras. Todos os imóveis ativos serão acessíveis pela IA.
            </p>
          )}
        </>
      )}
    </div>
  );
}
