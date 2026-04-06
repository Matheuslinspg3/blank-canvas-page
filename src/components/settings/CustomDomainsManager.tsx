import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Trash2, RefreshCw, Plus, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

function statusBadge(ssl: string, verification: string, isActive: boolean) {
  if (isActive) return <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />Ativo</Badge>;
  if (verification === "pending" || ssl === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{verification}</Badge>;
}

export function CustomDomainsManager() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");

  const orgId = profile?.organization_id;

  const { data: domains, isLoading } = useQuery({
    queryKey: ["tenant-domains", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_domains")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
        toast.success("Domínio ativo! SSL configurado.");
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
            <li>Clique em "Verificar" para atualizar o status</li>
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
          <div className="space-y-3">
            {domains.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{d.hostname}</p>
                    <p className="text-xs text-muted-foreground">SSL: {d.ssl_status} | Verificação: {d.verification_status}</p>
                  </div>
                  {statusBadge(d.ssl_status, d.verification_status, d.is_active)}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => checkMutation.mutate(d.id)}
                    disabled={checkMutation.isPending}
                    title="Verificar status"
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
