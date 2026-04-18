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

/**
 * Botão "Entrar com biometria" para a tela /auth.
 * Rollout controlado: visível apenas para developers + browsers compatíveis.
 * Reutiliza authenticateWithPasskey() — termina em verifyOtp e dispara SIGNED_IN.
 */
export function PasskeyLoginButton({ email, disabled }: PasskeyLoginButtonProps) {
  const { isSupported, checked } = usePasskeySupport();
  const { isDeveloper, isLoading: rolesLoading } = useUserRoles();
  const [loading, setLoading] = useState(false);

  // Gating: aguarda checks; só renderiza para developer + suporte real
  if (!checked || rolesLoading) return null;
  if (!isSupported || !isDeveloper) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      await authenticateWithPasskey(email?.trim() || undefined);
      // Sucesso: AuthContext.onAuthStateChange cuida do redirect
    } catch (err: any) {
      const name = err?.name || "";
      const msg = err?.message || "";

      if (name === "NotAllowedError" || /cancel|abort/i.test(msg)) {
        toast.info("Autenticação cancelada");
      } else if (/no.*credential|allowCredentials|not.*found/i.test(msg)) {
        toast.error("Nenhuma passkey encontrada", {
          description: "Use seu email e senha ou continue com Google.",
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
