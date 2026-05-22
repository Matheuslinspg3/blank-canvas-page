import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { BrokerConnectionCard } from "@/components/whatsapp/BrokerConnectionCard";
import { BrokerTemplatesCard } from "@/components/whatsapp/BrokerTemplatesCard";
import { BrokerAutomationCard } from "@/components/whatsapp/BrokerAutomationCard";
import { FollowUpConfigPanel } from "@/components/automations/FollowUpConfigPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Shield, Zap, BarChart3, MessagesSquare, Users, Settings } from "lucide-react";
import { FeatureFlagGate } from "@/components/FeatureGate";

export default function MyWhatsAppChannel() {
  return (
    <FeatureFlagGate featureKey="has_whatsapp">

    <>
      <Helmet>
        <title>Meu WhatsApp — Porta do Corretor</title>
        <meta name="description" content="Conecte seu número WhatsApp pessoal ao sistema." />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Meu WhatsApp</h1>
            <p className="text-muted-foreground mt-1">
              Conecte seu número pessoal para atender clientes diretamente pelo sistema.
            </p>
          </div>
          <Button asChild className="gap-1.5">
            <Link to="/whatsapp/meu-canal/chat">
              <MessagesSquare className="h-4 w-4" />
              Abrir conversas
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="connection" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="connection" className="gap-2">
              <Settings className="h-4 w-4" />
              Conexão e Configurações
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contatos e Follow-up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <BrokerConnectionCard />
                <BrokerAutomationCard />
                
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <Link to="/whatsapp/automacoes">
                      <BarChart3 className="h-4 w-4" />
                      Ver status e histórico
                    </Link>
                  </Button>
                </div>

                <BrokerTemplatesCard />
              </div>

              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Inbox integrada</p>
                        <p className="text-xs text-muted-foreground">
                          Mensagens do seu número aparecerão na sua inbox automaticamente.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Canal separado</p>
                        <p className="text-xs text-muted-foreground">
                          Seu WhatsApp pessoal não interfere no agente IA da imobiliária.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Sem custo de IA</p>
                        <p className="text-xs text-muted-foreground">
                          Mensagens do canal pessoal não consomem créditos de automação.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-medium">Placeholders disponíveis</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{"{nome}"}</code>
                        <span className="text-xs text-muted-foreground">Nome do contato</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{"{imovel}"}</code>
                        <span className="text-xs text-muted-foreground">Imóvel de interesse</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contacts">
            <FollowUpConfigPanel />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureFlagGate>
  );
}
