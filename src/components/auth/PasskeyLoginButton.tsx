import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authenticateWithPasskey } from "@/lib/passkeys/client";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";
import { useUserRoles } from "@/hooks/useUserRole";

interface PasskeyLoginButtonProps {
  email?: string;
  disabled?: boolean;
}

/** Override manual para beta — libera usuários específicos sem deploy:
 *  no console do navegador do usuário: localStorage.setItem('passkey_beta','1') */
function hasBetaOverride() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("passkey_beta") === "1";
  } catch {
    return false;
  }
}

/**
 * Botão "Entrar com biometria" para a tela /auth.
 * Rollout controlado: visível para developers OU usuários com flag beta local.
 * Reutiliza authenticateWithPasskey() — termina em verifyOtp e dispara SIGNED_IN.
 */
export function PasskeyLoginButton({ email, disabled }: PasskeyLoginButtonProps) {
  const { isSupported, checked } = usePasskeySupport();
  const { isDeveloper, isLoading: rolesLoading } = useUserRoles();
  const [loading, setLoading] = useState(false);

  // Gating: aguarda checks; só renderiza se browser suportar e (developer OU flag beta)
  if (!checked || rolesLoading) return null;
  if (!isSupported) return null;
  if (!isDeveloper && !hasBetaOverride()) return null;

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
