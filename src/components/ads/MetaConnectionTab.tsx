import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdAccount, useAdSettings } from "@/hooks/useAdSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, WifiOff, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import IntegrationConnectionCard from "./IntegrationConnectionCard";
import CrmAutomationCard from "./CrmAutomationCard";

export default function MetaConnectionTab() {
  const { account, isConnected, disconnectAccount } = useAdAccount();
  const { settings, updateSettings, isSaving: isSavingSettings } = useAdSettings();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [autoSend, setAutoSend] = useState(settings?.auto_send_to_crm ?? false);
  const [stageId, setStageId] = useState(settings?.crm_stage_id ?? "");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);

  useEffect(() => {
    if (settings) {
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.crm_stage_id || "");
    }
  }, [settings]);

  // Handle OAuth callback
  useEffect(() => {
    const metaSuccess = searchParams.get("meta_success");
    const metaError = searchParams.get("meta_error");
    if (!metaSuccess && !metaError) return;

    const nextParams = new URLSearchParams(searchParams);

    const invalidateMetaQueries = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-account"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-entities"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights-aggregated"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-leads-count"] }),
      ]);
    };

    const handleOAuthResult = async () => {
      if (metaSuccess) {
        nextParams.delete("meta_success");
        setSearchParams(nextParams, { replace: true });
        setIsInitialSyncing(true);
        try {
          const [entitiesResult, leadsResult] = await Promise.all([
            supabase.functions.invoke("meta-sync-entities", { body: { days_back: 30 } }),
            supabase.functions.invoke("meta-sync-leads", { body: { days_back: 30 } }),
          ]);
          if (entitiesResult.error) throw entitiesResult.error;
          await invalidateMetaQueries();
          const ads = entitiesResult.data?.ads ?? 0;
          const insights = entitiesResult.data?.insights ?? 0;
          const leads = leadsResult.error ? 0 : (leadsResult.data?.synced ?? 0);
          toast({ title: "Conectado!", description: `Sincronizado: ${ads} anúncios, ${insights} métricas e ${leads} leads.` });
        } catch {
          await invalidateMetaQueries();
          toast({ title: "Conta conectada", description: "Sincronização inicial incompleta. Use os botões abaixo.", variant: "destructive" });
        } finally {
          setIsInitialSyncing(false);
        }
      }
      if (metaError) {
        const errorMessages: Record<string, string> = {
          missing_params: "Parâmetros ausentes no callback.",
          invalid_state: "Estado inválido. Tente novamente.",
          server_config: "Configuração do servidor incompleta.",
          token_exchange: "Erro ao trocar código por token.",
          missing_permissions: "Permissões insuficientes. Aprove business_management.",
          no_ad_account: "Nenhuma conta de anúncios encontrada.",
          db_save: "Erro ao salvar dados.",
          unexpected: "Erro inesperado.",
          access_denied: "Permissões negadas.",
        };
        toast({ title: "Erro na conexão", description: errorMessages[metaError] || metaError, variant: "destructive" });
        nextParams.delete("meta_error");
        setSearchParams(nextParams, { replace: true });
      }
    };
    void handleOAuthResult();
  }, [queryClient, searchParams, setSearchParams, toast]);

  const handleConnectMeta = async () => {
    if (!profile?.organization_id || !profile?.user_id) return;
    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-app-id");
      if (error || !data?.app_id) {
        toast({ title: "Erro", description: "Não foi possível obter o App ID do Meta.", variant: "destructive" });
        setIsRedirecting(false);
        return;
      }
      const state = btoa(JSON.stringify({
        user_id: profile.user_id,
        org_id: profile.organization_id,
        redirect: window.location.pathname,
        origin: window.location.origin,
      }));
      const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectUri = `https://${supabaseProjectId}.supabase.co/functions/v1/meta-oauth-callback`;
      const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      oauthUrl.searchParams.set("client_id", data.app_id);
      oauthUrl.searchParams.set("redirect_uri", redirectUri);
      oauthUrl.searchParams.set("state", state);
      oauthUrl.searchParams.set("scope", "ads_read,ads_management,business_management,pages_show_list,pages_read_engagement,pages_manage_ads,leads_retrieval");
      oauthUrl.searchParams.set("auth_type", "rerequest");
      oauthUrl.searchParams.set("response_type", "code");
      window.location.href = oauthUrl.toString();
    } catch {
      toast({ title: "Erro", description: "Falha ao iniciar conexão.", variant: "destructive" });
      setIsRedirecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <IntegrationConnectionCard
        platform="Meta Ads"
        platformIcon={<Megaphone className="h-4 w-4" />}
        description="Conecte sua conta do Meta para gerenciar anúncios e leads."
        isConnected={!!isConnected}
        accountInfo={account?.external_account_id || undefined}
        accountName={account?.name || undefined}
        isConnecting={isRedirecting}
        isSyncing={isInitialSyncing}
        syncMessage="Sincronizando anúncios, métricas e leads iniciais..."
        onConnect={handleConnectMeta}
        onDisconnect={() => disconnectAccount()}
        connectLabel="Conectar com Meta"
        helpText="Clique para conectar sua conta do Meta Ads. Você será redirecionado para o Facebook."
      />

      <CrmAutomationCard
        autoSend={autoSend}
        onAutoSendChange={setAutoSend}
        stageId={stageId}
        onStageIdChange={setStageId}
        onSave={() => updateSettings({ autoSendToCrm: autoSend, crmStageId: stageId || null })}
        isSaving={isSavingSettings}
      />

      {isConnected && <MetaSyncSection />}
    </div>
  );
}

function MetaSyncSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncingEntities, setSyncingEntities] = useState(false);
  const [syncingLeads, setSyncingLeads] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-entities", { body: { days_back: 1 } });
      if (error) throw error;
      toast({ title: "Conexão OK!", description: `${data.campaigns} campanhas, ${data.ads} anúncios.` });
    } catch (err: any) {
      toast({ title: "Falha", description: err.message || "Token expirado?", variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncEntities = async () => {
    setSyncingEntities(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-entities", { body: { days_back: 30 } });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-entities"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights-aggregated"] }),
      ]);
      toast({ title: "Sincronizado", description: `${data.entities} entidades e ${data.insights} métricas.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncingEntities(false);
    }
  };

  const handleSyncLeads = async (daysBack: number) => {
    setSyncingLeads(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-leads", { body: { days_back: daysBack } });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-leads-count"] }),
      ]);
      toast({ title: "Leads sincronizados", description: `${data.synced} leads.${data.auto_sent > 0 ? ` ${data.auto_sent} enviados ao CRM.` : ""}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncingLeads(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Sincronização Manual
        </CardTitle>
        <CardDescription>Sincronize dados manualmente com o Meta Ads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testingConnection}>
            {testingConnection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WifiOff className="mr-2 h-4 w-4" />}
            Testar Conexão
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncEntities} disabled={syncingEntities}>
            {syncingEntities ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar Ads (30d)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSyncLeads(7)} disabled={syncingLeads}>
            {syncingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Leads (7d)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSyncLeads(30)} disabled={syncingLeads}>
            {syncingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Leads (30d)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
