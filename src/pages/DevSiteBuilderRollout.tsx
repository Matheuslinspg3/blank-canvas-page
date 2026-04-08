import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, ArrowRightLeft, Eye, ChevronDown, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import LazyMarkdown from "@/components/markdown/LazyMarkdown";

interface OrgRow {
  org_id: string;
  org_name: string;
  editor_mode: string;
  has_published_v1: boolean;
  has_draft_v2: boolean;
  has_published_v2: boolean;
  site_template: string | null;
}

type RolloutStatus = "legacy-only" | "v2-draft-ready" | "v2-published" | "advanced-active";

function computeStatus(row: OrgRow): RolloutStatus {
  if (row.editor_mode === "advanced" && row.has_published_v2) return "advanced-active";
  if (row.has_published_v2) return "v2-published";
  if (row.has_draft_v2) return "v2-draft-ready";
  return "legacy-only";
}

const statusConfig: Record<RolloutStatus, { label: string; className: string }> = {
  "legacy-only": { label: "Legacy Only", className: "bg-muted text-muted-foreground" },
  "v2-draft-ready": { label: "Draft Ready", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  "v2-published": { label: "V2 Published", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  "advanced-active": { label: "Advanced ✓", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

type Filter = "all" | "simple" | "advanced" | "has-published-v2" | "draft-no-publish";

const GUIDE_MD = `## Guia Operacional — Migração Site Builder v2

### Como migrar uma organização
1. Abra \`/dev/migrate-site-v2?orgId=<id>\`
2. Clique **"Preview V2 do legado"** para gerar o layout convertido
3. Revise o preview lado a lado (legado vs v2)
4. Clique **"Salvar como draft_v2"** → confirme
5. Clique **"Copiar draft → published"** → confirme
6. Clique **"Ativar advanced"** → confirme

### Como validar o storefront
- Abra \`/dev/storefront-v2?orgId=<id>\`
- Confirme que o renderer v2 aparece com as seções corretas
- Verifique meta title e description no painel DEV

### Como voltar para simple
- Na página de migração, clique **"Voltar simple"**
- O storefront público voltará ao renderer legado
- **Nada é apagado** — draft_v2 e published_v2 permanecem

### Quando NÃO migrar
- Org sem \`website_settings\` preenchido (conversão gera layout mínimo)
- Org com customizações CSS manuais no legado
- Org em período crítico de vendas (migrar fora do horário de pico)
`;

export default function DevSiteBuilderRollout() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["dev-rollout-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dev_list_org_rollout_status");
      if (error) throw error;
      return (data ?? []) as OrgRow[];
    },
  });

  const enriched = useMemo(() => (rows ?? []).map(r => ({ ...r, status: computeStatus(r) })), [rows]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "simple": return enriched.filter(r => r.editor_mode === "simple");
      case "advanced": return enriched.filter(r => r.editor_mode === "advanced");
      case "has-published-v2": return enriched.filter(r => r.has_published_v2);
      case "draft-no-publish": return enriched.filter(r => r.has_draft_v2 && !r.has_published_v2);
      default: return enriched;
    }
  }, [enriched, filter]);

  const metrics = useMemo(() => {
    const all = enriched;
    return {
      total: all.length,
      simple: all.filter(r => r.editor_mode === "simple").length,
      advanced: all.filter(r => r.editor_mode === "advanced").length,
      publishedV2: all.filter(r => r.has_published_v2).length,
      draftOnly: all.filter(r => r.has_draft_v2 && !r.has_published_v2).length,
      fallback: all.filter(r => !r.has_published_v1 && !r.has_published_v2).length,
    };
  }, [enriched]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Site Builder v2 — Rollout</h1>
        <p className="text-sm text-muted-foreground">Status de migração por organização</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: metrics.total },
          { label: "Simple", value: metrics.simple },
          { label: "Advanced", value: metrics.advanced },
          { label: "Published v2", value: metrics.publishedV2 },
          { label: "Draft s/ pub", value: metrics.draftOnly },
          { label: "Fallback", value: metrics.fallback },
        ].map(m => (
          <Card key={m.label} className="p-3">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-10" /> : m.value}</p>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filtro:</span>
        <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="simple">Somente Simple</SelectItem>
            <SelectItem value="advanced">Somente Advanced</SelectItem>
            <SelectItem value="has-published-v2">Com published_v2</SelectItem>
            <SelectItem value="draft-no-publish">Draft sem publish</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organização</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-center">Pub v1</TableHead>
              <TableHead className="text-center">Draft v2</TableHead>
              <TableHead className="text-center">Pub v2</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhuma organização encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(row => {
                const sc = statusConfig[row.status];
                return (
                  <TableRow key={row.org_id}>
                    <TableCell className="font-medium max-w-[180px] truncate">{row.org_name}</TableCell>
                    <TableCell>
                      <Badge variant={row.editor_mode === "advanced" ? "default" : "secondary"} className="text-[10px]">
                        {row.editor_mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{row.has_published_v1 ? "✅" : "❌"}</TableCell>
                    <TableCell className="text-center">{row.has_draft_v2 ? "✅" : "❌"}</TableCell>
                    <TableCell className="text-center">{row.has_published_v2 ? "✅" : "❌"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.site_template ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.className}`}>
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/dev/migrate-site-v2?orgId=${row.org_id}`} title="Migrar">
                            <ArrowRightLeft className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/dev/storefront-v2?orgId=${row.org_id}`} title="Storefront v2">
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Inline docs */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center gap-2 cursor-pointer">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Guia Operacional</CardTitle>
              <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <LazyMarkdown>{GUIDE_MD}</LazyMarkdown>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
