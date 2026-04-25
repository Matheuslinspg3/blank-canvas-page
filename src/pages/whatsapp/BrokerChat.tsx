import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useBrokerConversations } from "@/hooks/whatsapp/useBrokerChat";
import { BrokerChatList } from "@/components/whatsapp/broker-chat/BrokerChatList";
import { BrokerChatWindow } from "@/components/whatsapp/broker-chat/BrokerChatWindow";

export default function BrokerChat() {
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const { data: conversations, isLoading, channelId, channelStatus } = useBrokerConversations();
  const selectedConversation = conversations?.find((c) => c.remote_jid === selectedJid);

  return (
    <>
      <Helmet>
        <title>Chat — Meu WhatsApp</title>
        <meta name="description" content="Conversas do seu WhatsApp pessoal." />
      </Helmet>

      <div className="flex h-[calc(100vh-2rem)] flex-col">
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/whatsapp/meu-canal" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-display font-semibold">Conversas do meu canal</h1>
              <p className="text-xs text-muted-foreground">
                Apenas mensagens do seu número pessoal de WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {!channelId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/20 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">Você ainda não conectou seu canal pessoal.</p>
            <Button asChild>
              <Link to="/whatsapp/meu-canal">Conectar agora</Link>
            </Button>
          </div>
        ) : channelStatus !== "connected" ? (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span>
              Seu canal está <strong>{channelStatus}</strong>. Mensagens novas só serão recebidas
              quando estiver conectado.
            </span>
          </div>
        ) : null}

        {channelId && (
          <div className="grid flex-1 grid-cols-1 overflow-hidden rounded-lg border border-border md:grid-cols-[320px_1fr]">
            <BrokerChatList
              conversations={conversations ?? []}
              selectedJid={selectedJid}
              onSelect={setSelectedJid}
              isLoading={isLoading}
            />
            <BrokerChatWindow remoteJid={selectedJid} contactName={selectedConversation?.contact_name} />
          </div>
        )}
      </div>
    </>
  );
}
