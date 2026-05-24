import { useWhatsAppV2 } from "@/hooks/useWhatsAppV2";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Phone, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function WhatsAppStatusBanner() {
  const { status, connection } = useWhatsAppV2();
  const navigate = useNavigate();

  if (status === "connected") {
    return (
      <Alert className="bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-sm font-semibold">Canal WhatsApp ativo</AlertTitle>
        <AlertDescription className="text-xs flex items-center justify-between mt-1">
          <span>O número {connection?.phone_number} está pronto para ser usado em automações.</span>
          <Button variant="link" size="sm" onClick={() => navigate("/meu-whatsapp")} className="h-auto p-0 text-green-700 dark:text-green-400">
            Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-sm font-semibold">WhatsApp não conectado</AlertTitle>
      <AlertDescription className="text-xs flex items-center justify-between mt-1">
        <span>Conecte seu WhatsApp para habilitar o envio automático de mensagens para leads.</span>
        <Button variant="link" size="sm" onClick={() => navigate("/meu-whatsapp")} className="h-auto p-0 text-amber-700 dark:text-amber-400">
          Conectar agora <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
