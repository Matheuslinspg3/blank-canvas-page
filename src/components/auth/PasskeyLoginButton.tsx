import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authenticateWithPasskey } from "@/lib/passkeys/client";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";

interface PasskeyLoginButtonProps {
  email?: string;
  disabled?: boolean;
}

/**
 * Botão "Entrar com biometria" para a tela /auth.
 * Disponível para todos os usuários com browser compatível com WebAuthn.
 * Reutiliza authenticateWithPasskey() — termina em verifyOtp e dispara SIGNED_IN.
 */
export function PasskeyLoginButton({ email, disabled }: PasskeyLoginButtonProps) {
  const { isSupported, checked } = usePasskeySupport();
  const [loading, setLoading] = useState(false);

  // Gating: apenas suporte WebAuthn no browser
  if (!checked) return null;
  if (!isSupported) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      await authenticateWithPasskey(email?.trim() || undefined);
      // Sucesso: AuthContext.onAuthStateChange cuida do redirect
    } catch (err: any) {
      const name = err?.name || "";
      const msg = err?.message || "";

      if (name === "NotAllowedError") {
        // Pode ser cancelamento real OU "nenhuma credencial disponível" (browsers
        // unificam os dois por privacidade). Mensagem neutra com fallback claro.
        toast.info("Não foi possível entrar com biometria", {
          description:
            "Cancele se foi engano, ou use seu email e senha / Google abaixo.",
        });
      } else if (/abort/i.test(msg)) {
        toast.info("Autenticação cancelada");
      } else if (/desconhecida|not.*found|no.*credential|allowCredentials/i.test(msg)) {
        toast.error("Passkey não reconhecida", {
          description:
            "Esta passkey não está vinculada a uma conta. Entre com email e senha e registre-a em Configurações.",
        });
      } else if (/expirado|expired|challenge/i.test(msg)) {
        toast.error("Sessão de biometria expirou", {
          description: "Tente novamente.",
        });
      } else if (/clone|rollback/i.test(msg)) {
        toast.error("Passkey suspeita detectada", {
          description: "Por segurança, remova esta passkey em Configurações e cadastre uma nova.",
        });
      } else {
        toast.error("Falha ao entrar com biometria", {
          description: msg || "Tente novamente ou use outro método.",
        });
      }
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={loading || disabled}
      aria-label="Entrar com biometria (passkey)"
      className="w-full h-12 text-base bg-card hover:bg-muted/60 border-border/60"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <Fingerprint className="h-5 w-5 mr-2" />
          Entrar com biometria
        </>
      )}
    </Button>
  );
}
