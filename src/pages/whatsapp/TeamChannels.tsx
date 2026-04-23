import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TeamChannelsTable } from "@/components/whatsapp/TeamChannelsTable";
import { Users } from "lucide-react";

export default function TeamChannels() {
  return (
    <>
      <Helmet>
        <title>Canais da Equipe — Porta do Corretor</title>
        <meta name="description" content="Gerencie os canais WhatsApp individuais da equipe." />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Canais da Equipe</h1>
          <p className="text-muted-foreground mt-1">
            Visualize e gerencie os números WhatsApp conectados pelos corretores.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>WhatsApp dos Corretores</CardTitle>
                <CardDescription>Todos os canais individuais conectados na organização</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TeamChannelsTable />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
