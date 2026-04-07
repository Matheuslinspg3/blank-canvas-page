import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, ChevronRight, ChevronDown, ExternalLink, Copy, CheckCircle2,
  AlertCircle, HelpCircle, Loader2, Search, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Provider Guides ─────────────────────────────────────────────────────────

interface ProviderGuide {
  id: string;
  name: string;
  tags: string[];
  steps: { title: string; detail: string }[];
  helpUrl?: string;
  note?: string;
}

const PROVIDER_GUIDES: ProviderGuide[] = [
  {
    id: "registro-br-dns",
    name: "Registro.br (DNS próprio)",
    tags: ["Brasil", "Popular"],
    steps: [
      { title: "Acesse registro.br e faça login", detail: "Entre com seus dados em https://registro.br" },
      { title: "Clique no seu domínio", detail: "Na lista de domínios, clique no que deseja configurar" },
      { title: 'Vá em "DNS" → "Editar zona"', detail: 'Se aparecer "Utilizar os servidores DNS do Registro.br", ative essa opção primeiro' },
      { title: "Crie o registro CNAME", detail: 'Clique em "Nova entrada". Tipo: CNAME | Nome: www | Dados: portadocorretor.com.br' },
      { title: "Salve e aguarde", detail: "A propagação leva de 15 minutos a 24 horas. O sistema verifica automaticamente." },
    ],
    helpUrl: "https://registro.br/ajuda/registro-de-dominio/",
    note: "Se seu DNS está delegado para outra empresa (HostGator, Locaweb, QuickFast), configure o CNAME no painel dessa empresa, não no Registro.br.",
  },
  {
    id: "hospedagem-cpanel",
    name: "cPanel (HostGator, Locaweb, QuickFast, etc.)",
    tags: ["Brasil", "Hospedagem"],
    steps: [
      { title: "Acesse o cPanel da sua hospedagem", detail: "Geralmente em seudominio.com.br/cpanel ou pelo painel do provedor" },
      { title: 'Procure "Zone Editor" ou "Editor de Zona DNS"', detail: "Pode estar na seção 'Domínios' do cPanel" },
      { title: 'Clique em "Gerenciar" ao lado do seu domínio', detail: "Depois clique em '+ Adicionar Registro'" },
      { title: "Adicione o CNAME", detail: "Tipo: CNAME | Nome: www.seudominio.com.br | Registro: portadocorretor.com.br" },
      { title: "Salve", detail: "A propagação geralmente leva de 15 a 60 minutos." },
    ],
    note: "No cPanel, o campo 'Nome' geralmente precisa do domínio completo (ex: www.seudominio.com.br).",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    tags: ["Internacional", "Avançado"],
    steps: [
      { title: "Acesse dash.cloudflare.com", detail: "Faça login na sua conta Cloudflare" },
      { title: "Selecione seu domínio", detail: "Clique no domínio na lista de sites" },
      { title: 'Vá em "DNS" → "Records"', detail: "No menu lateral esquerdo" },
      { title: 'Clique em "Add Record"', detail: "Tipo: CNAME | Name: www | Target: portadocorretor.com.br | Proxy: ON (nuvem laranja)" },
      { title: "Salve", detail: "A propagação no Cloudflare é praticamente instantânea." },
    ],
    helpUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    tags: ["Internacional"],
    steps: [
      { title: "Acesse godaddy.com e faça login", detail: "Vá em 'Meus Produtos' → 'DNS' ao lado do seu domínio" },
      { title: 'Clique em "Gerenciar DNS"', detail: "Ou vá direto em 'Registros DNS'" },
      { title: 'Clique em "Adicionar"', detail: "Na seção de registros DNS" },
      { title: "Configure o CNAME", detail: "Tipo: CNAME | Host: www | Aponta para: portadocorretor.com.br | TTL: 1 hora" },
      { title: "Salve", detail: "Propagação: até 48 horas (geralmente 30 min)." },
    ],
    helpUrl: "https://br.godaddy.com/help/adicionar-um-registro-cname-19236",
  },
  {
    id: "hostinger",
    name: "Hostinger",
    tags: ["Internacional", "Popular"],
    steps: [
      { title: "Acesse hPanel da Hostinger", detail: "Em hpanel.hostinger.com, vá em 'Domínios'" },
      { title: 'Clique em "Gerenciar" → "DNS / Nameservers"', detail: "No menu do domínio" },
      { title: 'Vá em "Registros DNS"', detail: "Role até a seção de gerenciamento de DNS" },
      { title: "Adicione o CNAME", detail: "Tipo: CNAME | Nome: www | Aponta para: portadocorretor.com.br" },
      { title: "Salve", detail: "Propagação geralmente leva de 15 a 60 minutos." },
    ],
    helpUrl: "https://www.hostinger.com.br/tutoriais/como-apontar-dominio-para-outro-servidor",
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-sm font-mono transition-colors"
      title="Copiar"
    >
      {label || text}
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
}

interface DetectedProvider {
  id: string;
  name: string;
  panel_url: string | null;
  panel_instructions: string;
}

function ProviderCard({ guide, hostname, detected }: { guide: ProviderGuide; hostname: string; detected?: DetectedProvider | null }) {
  const isDetected = detected?.id === guide.id;
  const [expanded, setExpanded] = useState(isDetected);

  useEffect(() => {
    if (isDetected) setExpanded(true);
  }, [isDetected]);

  return (
    <div className={`rounded-lg border overflow-hidden transition-colors ${isDetected ? "border-primary ring-1 ring-primary/20" : "bg-card"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{guide.name}</p>
              {isDetected && (
                <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Detectado
                </Badge>
              )}
            </div>
            <div className="flex gap-1 mt-0.5">
              {guide.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t">
          {/* Detected provider panel link */}
          {isDetected && detected?.panel_url && (
            <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 p-3 space-y-1.5">
              <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Detectamos que seu DNS está na {detected.name}
              </p>
              <p className="text-xs text-muted-foreground">{detected.panel_instructions}</p>
              <a
                href={detected.panel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir painel da {detected.name}
              </a>
            </div>
          )}

          {/* Quick reference */}
          <div className={`mt-3 rounded-md bg-primary/5 border border-primary/20 p-3 space-y-2 ${isDetected && detected?.panel_url ? "" : "mt-3"}`}>
            <p className="text-xs font-medium text-primary">Dados para configuração:</p>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="text-muted-foreground">Tipo:</span>
              <Badge variant="outline" className="font-mono">CNAME</Badge>
              <span className="text-muted-foreground">Nome:</span>
              <CopyButton text="www" />
              <span className="text-muted-foreground">Destino:</span>
              <CopyButton text="portadocorretor.com.br" />
            </div>
          </div>

          {/* Steps */}
          <ol className="space-y-2">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Note */}
          {guide.note && (
            <div className="flex gap-2 text-xs p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300">{guide.note}</p>
            </div>
          )}

          {/* Help link */}
          {guide.helpUrl && (
            <a
              href={guide.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Ver documentação oficial
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

interface DomainSetupWizardProps {
  hostname?: string;
  cnameTarget?: string;
}

export function DomainSetupWizard({ hostname = "www.meusite.com.br", cnameTarget = "portadocorretor.com.br" }: DomainSetupWizardProps) {
  const [search, setSearch] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedProvider | null>(null);
  const [detectedNs, setDetectedNs] = useState<string[] | null>(null);

  // Auto-detect on mount when we have a real hostname
  useEffect(() => {
    if (hostname && hostname !== "www.meusite.com.br") {
      detectProvider(hostname);
    }
  }, [hostname]);

  const detectProvider = async (domain: string) => {
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-dns-provider", {
        body: { hostname: domain },
      });
      if (error) throw error;
      if (data?.provider) {
        setDetected(data.provider);
        toast.success(`Provedor detectado: ${data.provider.name}`, {
          description: data.provider.panel_instructions,
        });
      } else {
        setDetected(null);
        toast.info("Não foi possível detectar o provedor automaticamente", {
          description: data?.nameservers?.length
            ? `Nameservers encontrados: ${data.nameservers.join(", ")}`
            : "Verifique manualmente no seu registrador",
        });
      }
      if (data?.nameservers) {
        setDetectedNs(data.nameservers);
      }
    } catch (err) {
      console.error("detect-dns-provider error:", err);
    } finally {
      setDetecting(false);
    }
  };

  // Sort guides: detected first
  const sortedGuides = [...PROVIDER_GUIDES].sort((a, b) => {
    if (detected?.id === a.id) return -1;
    if (detected?.id === b.id) return 1;
    return 0;
  });

  const filtered = search.trim()
    ? sortedGuides.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : sortedGuides;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <HelpCircle className="h-4 w-4" />
          Como configurar o DNS
        </CardTitle>
        <CardDescription>
          {detected
            ? `Detectamos que o DNS do seu domínio está na ${detected.name}`
            : "O sistema detecta automaticamente onde está o DNS do seu domínio"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Detection result banner */}
        {detecting && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-primary">Detectando provedor DNS de <strong>{hostname}</strong>...</span>
          </div>
        )}

        {detected && !detecting && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Provedor detectado: {detected.name}
              </p>
            </div>
            <p className="text-xs text-green-700 dark:text-green-400">{detected.panel_instructions}</p>
            {detected.panel_url && (
              <a
                href={detected.panel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-300 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ir para o painel da {detected.name}
              </a>
            )}
            {detectedNs && detectedNs.length > 0 && (
              <p className="text-[10px] text-green-600/70 dark:text-green-500/70 mt-1">
                Nameservers: {detectedNs.join(", ")}
              </p>
            )}
          </div>
        )}

        {!detected && !detecting && detectedNs && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Provedor não reconhecido</p>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Nameservers: {detectedNs.join(", ")}. Procure o painel de DNS no provedor correspondente.
            </p>
          </div>
        )}

        {/* Summary box */}
        <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
          <p className="text-xs font-medium">Resumo da configuração:</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">Domínio:</span>
            <span className="font-medium">{hostname}</span>
            <span className="text-muted-foreground">Tipo de registro:</span>
            <Badge variant="outline" className="font-mono w-fit">CNAME</Badge>
            <span className="text-muted-foreground">Apontar para:</span>
            <CopyButton text={cnameTarget} />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar provedor (ex: Registro.br, HostGator, Cloudflare...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Provider list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-muted-foreground">Provedor não encontrado</p>
              <p className="text-xs text-muted-foreground">
                O processo é parecido para todos: crie um registro <strong>CNAME</strong> com nome <strong>www</strong> apontando para <strong>{cnameTarget}</strong>
              </p>
            </div>
          ) : (
            filtered.map((guide) => (
              <ProviderCard key={guide.id} guide={guide} hostname={hostname} detected={detected} />
            ))
          )}
        </div>

        {/* Generic tip */}
        <div className="flex gap-2 text-xs p-3 rounded-md border bg-muted/30">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Não sabe onde está seu DNS?</p>
            <p className="text-muted-foreground">
              O sistema detecta automaticamente quando você adiciona um domínio. Se não foi detectado,
              verifique no painel onde você registrou o domínio. Se os servidores DNS estão apontando para
              uma hospedagem, é no painel da <strong>hospedagem</strong> que você configura.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
