import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Key, Globe, Copy, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useRDStationSettings } from "@/hooks/useRDStationSettings";
import IntegrationConnectionCard from "../IntegrationConnectionCard";
import CrmAutomationCard from "../CrmAutomationCard";

export default function RDConnectionTab() {
  const { settings, isLoading, createSettings, updateSettings, orgId, queryClient, hasOAuth, oauthExpired } = useRDStationSettings();
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [apiPublicKey, setApiPublicKey] = useState("");
  const [apiPrivateKey, setApiPrivateKey] = useState("");
  const [autoSend, setAutoSend] = useState(true);
  const [stageId, setStageId] = useState("");
  const [defaultSource, setDefaultSource] = useState("RD Station");

  useEffect(() => {
    if (settings) {
      setApiPublicKey(settings.api_public_key || "");
      setApiPrivateKey(settings.api_private_key || "");
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.default_stage_id || "");
      setDefaultSource(settings.default_source || "RD Station");
    }
  }, [settings]);

  // OAuth callback handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("rd_success") === "true") {
      toast.success("Conta RD Station conectada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      window.history.replaceState({}, "", window.location.pathname + "?section=rdstation&rd_tab=conexao");
    }
    if (params.get("rd_error")) {
      const errMap: Record<string, string> = {
        missing_params: "Parâmetros ausentes",
        invalid_state: "Estado inválido",
        server_config: "Configuração incompleta",
        token_exchange: "Erro ao trocar código por token",
        db_save: "Erro ao salvar tokens",
        unexpected: "Erro inesperado",
      };
      toast.error(errMap[params.get("rd_error")!] || params.get("rd_error"));
      window.history.replaceState({}, "", window.location.pathname + "?section=rdstation&rd_tab=conexao");
    }
  }, [queryClient]);

  const handleConnectOAuth = async () => {
    setIsConnectingOAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-station-app-id");
      if (error || !data?.client_id) {
        toast.error("Erro ao obter Client ID.");
        setIsConnectingOAuth(false);
        return;
      }
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rd-station-oauth-callback`;
      const state = btoa(JSON.stringify({ org_id: orgId, origin: window.location.origin }));
      window.location.href = `https://api.rd.services/auth/dialog?client_id=${data.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    } catch {
      toast.error("Erro ao iniciar conexão OAuth.");
      setIsConnectingOAuth(false);
    }
  };

  const handleDisconnectOAuth = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("rd_station_settings")
        .update({ oauth_access_token: null, oauth_refresh_token: null, oauth_token_expires_at: null, oauth_client_id: null })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("OAuth desconectado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSaveSettings = () => {
    updateSettings.mutate(
      {
        auto_send_to_crm: autoSend,
        default_stage_id: stageId || null,
        default_source: defaultSource,
        api_public_key: apiPublicKey || null,
        api_private_key: apiPrivateKey || null,
      },
      {
        onSuccess: () => toast.success("Configurações salvas!"),
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  // Webhook URL
  const webhookUrl = settings
    ? `https://api.portadocorretor.com.br/rd-station-webhook?org=${orgId?.slice(0, 8)}&token=${(settings as any).webhook_secret}`
    : "";

  const regenerateWebhook = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const newSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase.from("rd_station_settings").update({ webhook_secret: newSecret }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("Webhook regenerado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // First-time setup
  if (!settings) {
    return (
      <Card className="border-l-4 border-l-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> RD Station Marketing
          </CardTitle>
          <CardDescription>
            Receba leads automaticamente do RD Station Marketing no seu CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => createSettings.mutate(undefined, {
              onSuccess: () => toast.success("Integração ativada!"),
              onError: (e: any) => toast.error(e.message),
            })}
            disabled={createSettings.isPending}
          >
            {createSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ativar Integração
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* OAuth Connection — same visual pattern as Meta */}
      <IntegrationConnectionCard
        platform="RD Station"
        platformIcon={<BarChart3 className="h-4 w-4" />}
        description="Conecte via OAuth para sincronizar contatos e acessar estatísticas."
        isConnected={hasOAuth}
        isExpired={oauthExpired}
        isConnecting={isConnectingOAuth}
        onConnect={handleConnectOAuth}
        onDisconnect={() => handleDisconnectOAuth.mutate()}
        connectLabel="Conectar com RD Station"
        helpText="A conexão OAuth permite sincronizar contatos e ver estatísticas do RD Station."
      />

      {/* Webhook URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Webhook
          </CardTitle>
          <CardDescription>
            Cole esta URL no RD Station → Integrações → Webhooks para receber leads automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="text-xs font-mono" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada!"); }}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => { if (confirm("Regenerar? A URL atual para de funcionar.")) regenerateWebhook.mutate(); }}
              disabled={regenerateWebhook.isPending}
            >
              {regenerateWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" /> Chaves de API
          </CardTitle>
          <CardDescription>
            Encontre em RD Station → Conta → Integrações → Chaves de API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label>Chave Pública</Label>
            <Input value={apiPublicKey} onChange={(e) => setApiPublicKey(e.target.value)} placeholder="Sua chave pública" />
          </div>
          <div className="space-y-2 max-w-md">
            <Label>Chave Privada</Label>
            <Input type="password" value={apiPrivateKey} onChange={(e) => setApiPrivateKey(e.target.value)} placeholder="Sua chave privada" />
            <p className="text-xs text-muted-foreground">Usada para enviar eventos de conversão.</p>
          </div>
        </CardContent>
      </Card>

      {/* CRM Automation — same visual pattern as Meta */}
      <CrmAutomationCard
        autoSend={autoSend}
        onAutoSendChange={setAutoSend}
        stageId={stageId}
        onStageIdChange={setStageId}
        defaultSource={defaultSource}
        onDefaultSourceChange={setDefaultSource}
        onSave={handleSaveSettings}
        isSaving={updateSettings.isPending}
        showSource
      />
    </div>
  );
}
