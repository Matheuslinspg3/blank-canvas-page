import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, KeyRound, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "setup_checklist_status";

interface ChecklistItem {
  id: string;
  section: "secrets" | "docs";
  label: string;
  value?: string;
  description: string;
}

const items: ChecklistItem[] = [
  {
    id: "secret_app_url",
    section: "secrets",
    label: "APP_URL",
    value: "https://portadocorretor.com.br",
    description: "URL base da aplicação. Usada em links de push notification, callbacks OAuth do Meta Ads e RD Station.",
  },
  {
    id: "secret_n8n_ticket",
    section: "secrets",
    label: "N8N_TICKET_WEBHOOK_URL",
    value: "https://n8n.costazul.shop/webhook/lovableportadocorrerora",
    description: "Webhook do N8N para o chat de suporte. Movido de hardcoded para variável de ambiente.",
  },
  {
    id: "secret_n8n_creci",
    section: "secrets",
    label: "N8N_CRECI_WEBHOOK_URL",
    value: "https://n8n.costazul.shop/webhook/verify-creci",
    description: "Webhook do N8N para verificação de CRECI. Movido de hardcoded para variável de ambiente.",
  },
  {
    id: "doc_readme",
    section: "docs",
    label: "README.md",
    description: 'Substituir "habitae1.lovable.app" → "portadocorretor.com.br"',
  },
  {
    id: "doc_robots",
    section: "docs",
    label: "robots.txt",
    description: 'Substituir "habitae1.lovable.app" → "portadocorretor.com.br"',
  },
];

function loadChecked(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function useSetupPendingCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const checked = loadChecked();
      setCount(items.filter((i) => !checked[i.id]).length);
    };
    update();
    window.addEventListener("storage", update);
    // custom event for same-tab updates
    window.addEventListener("setup-checklist-change", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("setup-checklist-change", update);
    };
  }, []);

  return count;
}

export function SetupChecklistTab() {
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("setup-checklist-change"));
      return next;
    });
  }, []);

  const doneCount = items.filter((i) => checked[i.id]).length;
  const allDone = doneCount === items.length;
  const pct = Math.round((doneCount / items.length) * 100);

  const secrets = items.filter((i) => i.section === "secrets");
  const docs = items.filter((i) => i.section === "docs");

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card className={allDone ? "border-green-500/40 bg-green-500/5" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {allDone ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            {allDone
              ? "Configuração pós-auditoria completa ✓"
              : `${doneCount} de ${items.length} itens concluídos`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={pct} className="h-2" />
        </CardContent>
      </Card>

      {/* Section 1 — Secrets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Secrets pendentes no Supabase
          </CardTitle>
          <CardDescription>
            Configurar em Settings → Edge Functions → Secrets no painel do Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {secrets.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${checked[item.id] ? "bg-muted/40 opacity-60" : ""}`}
            >
              <Checkbox
                checked={!!checked[item.id]}
                onCheckedChange={() => toggle(item.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-mono text-sm font-semibold">{item.label}</p>
                {item.value && (
                  <code className="block text-xs bg-muted px-2 py-1 rounded break-all">
                    {item.value}
                  </code>
                )}
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Button
                size="sm"
                variant={checked[item.id] ? "ghost" : "outline"}
                onClick={() => toggle(item.id)}
                className="shrink-0 text-xs"
              >
                {checked[item.id] ? "Feito ✓" : "Marcar como feito"}
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              window.open("https://supabase.com/dashboard/project/_/settings/functions", "_blank")
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir painel do Supabase
          </Button>
        </CardContent>
      </Card>

      {/* Section 2 — Docs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Arquivos de documentação para atualizar
          </CardTitle>
          <CardDescription>
            Substituir referências ao domínio antigo{" "}
            <code className="text-xs bg-muted px-1 rounded">habitae1.lovable.app</code> →{" "}
            <code className="text-xs bg-muted px-1 rounded">portadocorretor.com.br</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {docs.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${checked[item.id] ? "bg-muted/40 opacity-60" : ""}`}
            >
              <Checkbox
                checked={!!checked[item.id]}
                onCheckedChange={() => toggle(item.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-mono text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Button
                size="sm"
                variant={checked[item.id] ? "ghost" : "outline"}
                onClick={() => toggle(item.id)}
                className="shrink-0 text-xs"
              >
                {checked[item.id] ? "Feito ✓" : "Marcar como feito"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
