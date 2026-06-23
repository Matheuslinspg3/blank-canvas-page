import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building, Tags, Mail, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PropRow {
  property_id: string;
  code: string | null;
  title: string | null;
  organization_id: string | null;
  organization_name: string | null;
  status: string;
  marketplace_active: boolean;
  updated_at: string;
}

interface AmenityRow {
  amenity_id: string;
  name: string;
  category: string;
  is_default: boolean;
  organization_id: string | null;
  organization_name: string | null;
  is_global: boolean;
  duplicates_global: boolean;
}

interface InviteRow {
  invite_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  organization_id: string | null;
  organization_name: string | null;
  user_already_exists: boolean;
}

function useDebugRpc<T>(name: "debug_properties_visibility" | "debug_amenities_overview" | "debug_invites_overview") {
  return useQuery({
    queryKey: ["dev-visibility", name],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(name as never);
      if (error) throw error;
      return (data ?? []) as T[];
    },
    staleTime: 30_000,
  });
}

function PropertiesTab() {
  const { data = [], isLoading } = useDebugRpc<PropRow>("debug_properties_visibility");
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [onlyPublished, setOnlyPublished] = useState<string>("all");

  const orgs = useMemo(() => {
    const m = new Map<string, string>();
    data.forEach((r) => r.organization_id && m.set(r.organization_id, r.organization_name ?? "—"));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return data.filter((r) => {
      if (orgFilter !== "all" && r.organization_id !== orgFilter) return false;
      if (onlyPublished === "yes" && !r.marketplace_active) return false;
      if (onlyPublished === "no" && r.marketplace_active) return false;
      if (s && !((r.code ?? "").toLowerCase().includes(s) || (r.title ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [data, search, orgFilter, onlyPublished]);

  const grouped = useMemo(() => {
    const m = new Map<string, PropRow[]>();
    filtered.forEach((r) => {
      const key = r.organization_id ?? "__none__";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return Array.from(m.entries());
  }, [filtered]);

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando imóveis...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por código ou título..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Organização" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as organizações</SelectItem>
            {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={onlyPublished} onValueChange={setOnlyPublished}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Marketplace: todos</SelectItem>
            <SelectItem value="yes">Apenas publicados</SelectItem>
            <SelectItem value="no">Apenas não publicados</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground self-center">
          {filtered.length} de {data.length} imóveis
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map(([orgId, rows]) => (
          <Card key={orgId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building className="h-4 w-4" />
                {rows[0]?.organization_name ?? "Sem organização"}
                <Badge variant="outline" className="ml-2">{rows.length}</Badge>
                <Badge variant="secondary" className="ml-1">{rows.filter((r) => r.marketplace_active).length} no marketplace</Badge>
                <code className="ml-auto text-[10px] text-muted-foreground">{orgId}</code>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-left py-1 pr-2">Código</th>
                      <th className="text-left py-1 pr-2">Título</th>
                      <th className="text-left py-1 pr-2">Status</th>
                      <th className="text-left py-1 pr-2">Marketplace</th>
                      <th className="text-left py-1 pr-2">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.property_id} className="border-b last:border-0">
                        <td className="py-1 pr-2 font-mono">{r.code ?? "—"}</td>
                        <td className="py-1 pr-2 max-w-[280px] truncate">{r.title}</td>
                        <td className="py-1 pr-2">{r.status}</td>
                        <td className="py-1 pr-2">
                          {r.marketplace_active
                            ? <Badge variant="default" className="text-[10px]">publicado</Badge>
                            : <Badge variant="outline" className="text-[10px]">não</Badge>}
                        </td>
                        <td className="py-1 pr-2 text-muted-foreground">{new Date(r.updated_at).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AmenitiesTab() {
  const { data = [], isLoading } = useDebugRpc<AmenityRow>("debug_amenities_overview");

  const globals = data.filter((a) => a.is_global);
  const perOrg = data.filter((a) => !a.is_global);
  const orgs = useMemo(() => {
    const m = new Map<string, { name: string; rows: AmenityRow[] }>();
    perOrg.forEach((r) => {
      const k = r.organization_id ?? "__none__";
      if (!m.has(k)) m.set(k, { name: r.organization_name ?? "—", rows: [] });
      m.get(k)!.rows.push(r);
    });
    return Array.from(m.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [perOrg]);

  const duplicates = perOrg.filter((r) => r.duplicates_global);

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando características...</div>;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Catálogo global</div><div className="text-2xl font-semibold">{globals.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Customizações por org</div><div className="text-2xl font-semibold">{perOrg.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1">{duplicates.length > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" />}Duplicatas do global</div><div className="text-2xl font-semibold">{duplicates.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Catálogo global (visível para todas as orgs)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {globals.map((g) => (
              <Badge key={g.amenity_id} variant="secondary" className="text-xs">
                {g.name} <span className="opacity-60 ml-1">· {g.category}</span>
              </Badge>
            ))}
            {globals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma característica global cadastrada.</p>}
          </div>
        </CardContent>
      </Card>

      {orgs.map(([orgId, { name, rows }]) => (
        <Card key={orgId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building className="h-4 w-4" />
              {name}
              <Badge variant="outline">{rows.length}</Badge>
              {rows.some((r) => r.duplicates_global) && (
                <Badge variant="destructive" className="text-[10px]">
                  {rows.filter((r) => r.duplicates_global).length} duplicam global
                </Badge>
              )}
              <code className="ml-auto text-[10px] text-muted-foreground">{orgId}</code>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <Badge
                  key={r.amenity_id}
                  variant={r.duplicates_global ? "destructive" : "outline"}
                  className="text-xs"
                  title={r.duplicates_global ? "Mesmo nome existe no catálogo global" : undefined}
                >
                  {r.name} <span className="opacity-60 ml-1">· {r.category}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvitesTab() {
  const { data = [], isLoading } = useDebugRpc<InviteRow>("debug_invites_overview");
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const filtered = useMemo(() => statusFilter === "all" ? data : data.filter((r) => r.status === statusFilter), [data, statusFilter]);

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando convites...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="accepted">Aceitos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">{filtered.length} convites</div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Organização</th>
                <th className="text-left p-2">Papel</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Já tem conta?</th>
                <th className="text-left p-2">Expira</th>
                <th className="text-left p-2">Criado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const expired = new Date(r.expires_at).getTime() < Date.now();
                return (
                  <tr key={r.invite_id} className="border-t">
                    <td className="p-2">{r.email}</td>
                    <td className="p-2">{r.organization_name ?? "—"}</td>
                    <td className="p-2">{r.role}</td>
                    <td className="p-2">
                      <Badge variant={r.status === "pending" ? "default" : "outline"} className="text-[10px]">{r.status}</Badge>
                    </td>
                    <td className="p-2">
                      {r.user_already_exists
                        ? <Badge variant="secondary" className="text-[10px]">sim · usa login</Badge>
                        : <Badge variant="outline" className="text-[10px]">não · pode criar</Badge>}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {expired ? <span className="text-destructive">expirado</span> : new Date(r.expires_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhum convite.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VisibilityDebug() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Diagnóstico de Visibilidade"
        description="Imóveis por organização, características globais × por org e convites pendentes"
      />
      <div className="flex-1 p-4 sm:p-6">
        <Tabs defaultValue="properties">
          <TabsList>
            <TabsTrigger value="properties" className="gap-2"><Building className="h-4 w-4" />Imóveis</TabsTrigger>
            <TabsTrigger value="amenities" className="gap-2"><Tags className="h-4 w-4" />Características</TabsTrigger>
            <TabsTrigger value="invites" className="gap-2"><Mail className="h-4 w-4" />Convites</TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="mt-4"><PropertiesTab /></TabsContent>
          <TabsContent value="amenities" className="mt-4"><AmenitiesTab /></TabsContent>
          <TabsContent value="invites" className="mt-4"><InvitesTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
