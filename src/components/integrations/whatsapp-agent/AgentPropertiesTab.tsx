
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Star, ShieldOff, Search } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { useWhatsAppPropertyRules, type RuleType } from "@/hooks/useWhatsAppPropertyRules";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function BlacklistManager() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "blocked" | "allowed">("all");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties-blacklist", profile?.organization_id, search],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let q = supabase
        .from("properties")
        .select("id, title, property_code, address_neighborhood, address_city, ai_blacklist" as any)
        .eq("organization_id", profile.organization_id)
        .eq("status", "disponivel")
        .order("property_code")
        .limit(200);
      if (search) {
        q = q.or(`title.ilike.%${search}%,property_code.ilike.%${search}%,address_neighborhood.ilike.%${search}%`);
      }
      const { data } = await q;
      return (data ?? []) as any[];
    },
    enabled: !!profile?.organization_id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { error } = await supabase
        .from("properties")
        .update({ ai_blacklist: blocked } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties-blacklist"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, blocked }: { ids: string[]; blocked: boolean }) => {
      const { error } = await supabase
        .from("properties")
        .update({ ai_blacklist: blocked } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties-blacklist"] });
      toast.success("Imóveis atualizados com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar em lote: " + err.message);
    },
  });

  const filtered = useMemo(() => {
    if (filter === "blocked") return properties.filter((p: any) => p.ai_blacklist);
    if (filter === "allowed") return properties.filter((p: any) => !p.ai_blacklist);
    return properties;
  }, [properties, filter]);

  const blockedCount = properties.filter((p: any) => p.ai_blacklist).length;
  const allowedCount = properties.length - blockedCount;

  const handleBlockAll = () => {
    const ids = filtered.filter((p: any) => !p.ai_blacklist).map((p: any) => p.id);
    if (ids.length) bulkMutation.mutate({ ids, blocked: true });
  };

  const handleAllowAll = () => {
    const ids = filtered.filter((p: any) => p.ai_blacklist).map((p: any) => p.id);
    if (ids.length) bulkMutation.mutate({ ids, blocked: false });
  };

  const busy = toggleMutation.isPending || bulkMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldOff className="h-4 w-4" /> Blacklist de Imóveis
        </CardTitle>
        <CardDescription>
          Imóveis bloqueados não serão apresentados pela IA. 
          <span className="font-medium ml-1">{allowedCount} liberados</span> · <span className="font-medium">{blockedCount} bloqueados</span>
        </CardDescription>
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
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="allowed">✅ Liberados</SelectItem>
              <SelectItem value="blocked">🚫 Bloqueados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between border rounded-md p-2 bg-muted/30">
          <span className="text-xs text-muted-foreground">
            {filtered.length} imóvel(is) exibido(s)
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={handleAllowAll}>
              ✅ Liberar todos
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" disabled={busy} onClick={handleBlockAll}>
              🚫 Bloquear todos
            </Button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1">
          {filtered.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium">{p.property_code}</span>
                <span className="text-muted-foreground ml-2 truncate">{p.title}</span>
                {p.address_neighborhood && (
                  <span className="text-muted-foreground text-xs ml-1">• {p.address_neighborhood}</span>
                )}
              </div>
              <Switch
                checked={!p.ai_blacklist}
                onCheckedChange={(checked) => toggleMutation.mutate({ id: p.id, blocked: !checked })}
                disabled={busy}
              />
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum imóvel encontrado</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const RULE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  highlight: { label: "Destaque", icon: Star, color: "text-yellow-500" },
};

export function AgentPropertiesTab() {
  const { config, saveConfig, isSaving } = useWhatsAppAgentConfig();
  const { rules, highlights, addRule, removeRule, isAdding, isRemoving } =
    useWhatsAppPropertyRules();
  const { profile } = useAuth();

  const existingIds = new Set(rules.map((r) => `${r.property_id}-${r.rule_type}`));

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

  const renderHighlights = () => {
    if (!highlights.length) return null;
    const meta = RULE_META.highlight;
    const Icon = meta.icon;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className={`h-4 w-4 ${meta.color}`} /> {meta.label} ({highlights.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {highlights.map((rule) => {
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
                    <ShieldOff className="h-3.5 w-3.5 text-destructive" />
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
          <BlacklistManager />
          {renderHighlights()}
        </>
      )}
    </div>
  );
}
