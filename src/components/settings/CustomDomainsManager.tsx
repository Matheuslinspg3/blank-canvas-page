import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Globe, Trash2, RefreshCw, Plus, CheckCircle2, Clock, AlertCircle, Loader2, Shield, Wifi, FileCheck } from "lucide-react";
import { toast } from "sonner";

interface DomainRecord {
  id: string;
  hostname: string;
  ssl_status: string;
  verification_status: string;
  is_active: boolean;
  created_at: string;
  cloudflare_hostname_id: string | null;
}

function getProvisioningSteps(d: DomainRecord) {
  const steps = [
    {
      label: "CNAME configurado",
      icon: Wifi,
      done: d.verification_status === "active" || d.verification_status === "active_redeploying",
      active: d.verification_status === "pending" || d.verification_status === "moved",
      detail: d.verification_status === "pending"
        ? "Aguardando você apontar o CNAME no DNS"
        : d.verification_status === "active"
        ? "DNS verificado ✓"
        : d.verification_status,
    },
    {
      label: "Verificação",
      icon: FileCheck,
      done: d.verification_status === "active" || d.verification_status === "active_redeploying",
      active: d.verification_status !== "pending" && d.verification_status !== "active",
      detail: d.verification_status === "active"
        ? "Domínio verificado ✓"
        : d.verification_status === "pending"
        ? "Aguardando DNS"
        : `Status: ${d.verification_status}`,
    },
    {
      label: "SSL / HTTPS",
      icon: Shield,
      done: d.ssl_status === "active",
      active: d.verification_status === "active" && d.ssl_status !== "active",
      detail: d.ssl_status === "active"
        ? "Certificado emitido ✓"
        : d.ssl_status === "pending_validation" || d.ssl_status === "pending_issuance"
        ? "Emitindo certificado..."
        : d.ssl_status === "initializing"
        ? "Inicializando SSL..."
        : `SSL: ${d.ssl_status}`,
    },
    {
      label: "Ativo",
      icon: CheckCircle2,
      done: d.is_active,
      active: false,
      detail: d.is_active ? "Site no ar! 🎉" : "Aguardando etapas anteriores",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return { steps, progress, doneCount };
}

function getTimeSinceCreation(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function StatusStepper({ domain }: { domain: DomainRecord }) {
  const { steps, progress } = getProvisioningSteps(domain);

  if (domain.is_active) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-medium">Domínio ativo e funcionando</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-3">
        <Progress value={progress} className="flex-1 h-2" />
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{progress}%</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                step.done
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                  : step.active
                  ? "border-primary/30 bg-primary/5 animate-pulse"
                  : "border-border bg-muted/30"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                  step.done ? "text-green-600" : step.active ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0">
                <p className={`font-medium ${step.done ? "text-green-700 dark:text-green-400" : ""}`}>{step.label}</p>
                <p className="text-muted-foreground truncate">{step.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CustomDomainsManager() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");

  const orgId = profile?.organization_id;

  const { data: domains, isLoading } = useQuery({
    queryKey: ["tenant-domains", orgId],
    enabled: !!orgId,
    refetchInterval: (query) => {
      const data = query.state.data as DomainRecord[] | undefined;
      const hasPending = data?.some((d) => !d.is_active);
      return hasPending ? 15_000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_domains")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DomainRecord[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (hostname: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "create", hostname },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Domínio cadastrado!", {
        description: data.instructions || "Configure o CNAME e aguarde a verificação.",
      });
      setNewHostname("");
      queryClient.invalidateQueries({ queryKey: ["tenant-domains"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao cadastrar domínio"),
  });

  const checkMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "check_status", domain_id: domainId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-domains"] });
      if (data.is_active) {
        toast.success("Domínio ativo! SSL configurado. 🎉");
      } else {
        toast.info(`SSL: ${data.ssl_status} | Verificação: ${data.verification_status}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "delete", domain_id: domainId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Domínio removido");
      queryClient.invalidateQueries({ queryKey: ["tenant-domains"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const h = newHostname.trim().toLowerCase();
    if (!h || !h.includes(".")) {
      toast.error("Digite um domínio válido (ex: www.meusite.com.br)");
      return;
    }
    createMutation.mutate(h);
  };

  // Auto-check pending domains periodically
  const pendingDomains = domains?.filter((d) => !d.is_active) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Domínios Customizados
        </CardTitle>
        <CardDescription>
          Conecte seu domínio próprio ao site da imobiliária. O SSL é emitido automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new domain */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder="www.meusite.com.br"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </form>

        {/* Instructions */}
        <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-2">
          <p className="font-medium">Como configurar:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Adicione o domínio acima</li>
            <li>No painel DNS do seu domínio, crie um <strong>CNAME</strong> apontando para <code className="bg-muted px-1 rounded">portadocorretor.com.br</code></li>
            <li>Aguarde a verificação e emissão do SSL (pode levar alguns minutos)</li>
            <li>O status atualiza automaticamente a cada 15 segundos</li>
          </ol>
        </div>

        {/* Domain list */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !domains?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum domínio cadastrado.</p>
        ) : (
          <div className="space-y-4">
            {domains.map((d) => (
              <div key={d.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{d.hostname}</p>
                      <p className="text-xs text-muted-foreground">
                        Criado há {getTimeSinceCreation(d.created_at)}
                        {!d.is_active && " • Atualiza automaticamente"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => checkMutation.mutate(d.id)}
                      disabled={checkMutation.isPending}
                      title="Verificar agora"
                    >
                      <RefreshCw className={`h-4 w-4 ${checkMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Remover este domínio?")) deleteMutation.mutate(d.id);
                      }}
                      disabled={deleteMutation.isPending}
                      title="Remover domínio"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Progress stepper */}
                <StatusStepper domain={d} />
              </div>
            ))}
          </div>
        )}

        {pendingDomains.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            ⏱️ Domínios pendentes atualizam automaticamente a cada 15 segundos
          </p>
        )}
      </CardContent>
    </Card>
  );
}