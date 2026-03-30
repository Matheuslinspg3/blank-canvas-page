
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, Bot, Building2, UserCheck, ArrowRightLeft, MessageCircle } from "lucide-react";
import { WhatsAppIntegrationCard } from "@/components/integrations/WhatsAppIntegrationCard";
import { AgentBehaviorTab } from "./AgentBehaviorTab";
import { AgentPropertiesTab } from "./AgentPropertiesTab";
import { AgentQualificationTab } from "./AgentQualificationTab";
import { AgentTransferTab } from "./AgentTransferTab";
import { WhatsAppChatPanel } from "./WhatsAppChatPanel";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";

export function WhatsAppAgentPanel() {
  const { instance } = useWhatsAppInstance();
  const isConnected = instance?.status === "connected";

  return (
    <Tabs defaultValue="conexao" className="space-y-4">
      <TabsList className="bg-muted/50 overflow-x-auto flex-nowrap h-auto gap-1 p-1 w-full">
        <TabsTrigger value="conexao" className="gap-1.5 text-xs sm:text-sm shrink-0">
          <Wifi className="h-3.5 w-3.5" /> Conexão
        </TabsTrigger>
        {isConnected && (
          <>
            <TabsTrigger value="comportamento" className="gap-1.5 text-xs sm:text-sm shrink-0">
              <Bot className="h-3.5 w-3.5" /> Comportamento
            </TabsTrigger>
            <TabsTrigger value="imoveis" className="gap-1.5 text-xs sm:text-sm shrink-0">
              <Building2 className="h-3.5 w-3.5" /> Imóveis
            </TabsTrigger>
            <TabsTrigger value="qualificacao" className="gap-1.5 text-xs sm:text-sm shrink-0">
              <UserCheck className="h-3.5 w-3.5" /> Qualificação
            </TabsTrigger>
            <TabsTrigger value="transferencia" className="gap-1.5 text-xs sm:text-sm shrink-0">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transferência
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5 text-xs sm:text-sm shrink-0">
              <MessageCircle className="h-3.5 w-3.5" /> Chat
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <TabsContent value="conexao">
        <WhatsAppIntegrationCard />
      </TabsContent>

      {isConnected && (
        <>
          <TabsContent value="comportamento">
            <AgentBehaviorTab />
          </TabsContent>

          <TabsContent value="imoveis">
            <AgentPropertiesTab />
          </TabsContent>

          <TabsContent value="qualificacao">
            <AgentQualificationTab />
          </TabsContent>

          <TabsContent value="transferencia">
            <AgentTransferTab />
          </TabsContent>

          <TabsContent value="chat">
            <WhatsAppChatPanel />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
