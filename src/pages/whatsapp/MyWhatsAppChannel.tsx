import { Helmet } from "react-helmet-async";
import { BrokerConnectionCard } from "@/components/whatsapp/BrokerConnectionCard";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Shield, Zap } from "lucide-react";

export default function MyWhatsAppChannel() {
  return (
    <>
      <Helmet>
        <title>Meu WhatsApp — Porta do Corretor</title>
        <meta name="description" content="Conecte seu número WhatsApp pessoal ao sistema." />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Meu WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Conecte seu número pessoal para atender clientes diretamente pelo sistema.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <BrokerConnectionCard />
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
          </div>
        </div>
      </div>
    </>
  );
}
