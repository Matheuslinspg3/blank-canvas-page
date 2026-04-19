import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";
import { registerPasskey } from "@/lib/passkeys/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Convida o usuário a ativar passkey/biometria neste dispositivo após login/cadastro/onboarding.
 *
 * Regras:
 * - só renderiza se WebAuthn for suportado
 * - só aparece se o usuário ainda NÃO tiver passkey registrada
 * - respeita "não mostrar novamente neste dispositivo" via localStorage
 * - mostra no máximo 1x por sessão (sessionStorage)
 * - aguarda perfil + onboarding completo (montado dentro do ProtectedRoute)
 */
export function PasskeyEnrollmentPrompt() {
  const { user, profile } = useAuth();
  const { isSupported, hasPlatformAuthenticator, checked } = usePasskeySupport();

  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const userId = user?.id;
  const dismissKey = userId ? `passkey_dismiss_${userId}` : null;
  const sessionKey = userId ? `passkey_prompt_shown_${userId}` : null;
  const enrolledKey = userId ? `passkey_enrolled_${userId}` : null;

  useEffect(() => {
    if (!userId || !checked) return;
    if (!isSupported || !hasPlatformAuthenticator) return;
    if (!profile?.onboarding_completed) return;
    if (!dismissKey || !sessionKey || !enrolledKey) return;

    // já registrou passkey neste dispositivo
    if (localStorage.getItem(enrolledKey) === "1") return;
    // já marcou "não mostrar mais" neste dispositivo
    if (localStorage.getItem(dismissKey) === "forever") return;
    // já apresentado nesta sessão do navegador
    if (sessionStorage.getItem(sessionKey) === "1") return;

    const timer = window.setTimeout(() => {
      sessionStorage.setItem(sessionKey, "1");
      setOpen(true);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [userId, checked, isSupported, hasPlatformAuthenticator, profile?.onboarding_completed, dismissKey, sessionKey, enrolledKey]);

  const handleDismiss = () => {
    if (dontShowAgain && dismissKey) {
      localStorage.setItem(dismissKey, "forever");
    }
    setOpen(false);
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const deviceName =
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "Dispositivo";
      await registerPasskey(deviceName);
      if (enrolledKey) localStorage.setItem(enrolledKey, "1");
      toast.success("Biometria ativada", {
        description: "Da próxima vez, entre direto com sua digital ou Face ID.",
      });
      setOpen(false);
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || /abort/i.test(err?.message || "")) {
        toast.info("Ativação cancelada", {
          description: "Você pode ativar depois em Configurações.",
        });
      } else {
        toast.error("Não foi possível ativar a biometria", {
          description: err?.message || "Tente novamente em Configurações.",
        });
      }
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Fingerprint className="h-6 w-6 text-accent" />
          </div>
          <AlertDialogTitle className="text-center">
            Ativar biometria neste dispositivo
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Entre mais rápido nas próximas vezes usando digital, Face ID ou bloqueio do aparelho.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="passkey-dont-show"
            checked={dontShowAgain}
            onCheckedChange={(v) => setDontShowAgain(v === true)}
          />
          <label
            htmlFor="passkey-dont-show"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Não mostrar novamente neste dispositivo
          </label>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleDismiss} disabled={enrolling}>
            Agora não
          </Button>
          <Button variant="gold" onClick={handleEnroll} disabled={enrolling}>
            {enrolling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Ativando...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4 mr-2" />
                Ativar agora
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
