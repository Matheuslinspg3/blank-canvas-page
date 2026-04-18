import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Fingerprint, Trash2, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";
import { useUserRoles } from "@/hooks/useUserRole";
import { listPasskeys, registerPasskey, deletePasskey } from "@/lib/passkeys/client";

interface Passkey {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
  backed_up: boolean;
}

export function PasskeysSection() {
  const { isSupported, hasPlatformAuthenticator, checked } = usePasskeySupport();
  const { isDeveloper } = useUserRoles();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);

  // Rollout interno: por enquanto só developers vêem a seção
  const enabled = isDeveloper;

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listPasskeys();
      setPasskeys(list as Passkey[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) reload();
  }, [enabled]);

  if (!enabled) return null;

  const defaultName = () => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return "iPhone";
    if (/iPad/.test(ua)) return "iPad";
    if (/Android/.test(ua)) return "Android";
    if (/Mac/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows";
    return "Este dispositivo";
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      await registerPasskey(deviceName.trim() || defaultName());
      toast.success("Passkey registrada com sucesso");
      setRegisterOpen(false);
      setDeviceName("");
      await reload();
    } catch (e: any) {
      const msg = e?.message ?? "Erro ao registrar passkey";
      if (/NotAllowedError|cancel/i.test(msg)) {
        toast.info("Registro cancelado");
      } else {
        toast.error("Não foi possível registrar", { description: msg });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id: string, name: string | null) => {
    if (!confirm(`Remover passkey "${name ?? "dispositivo"}"?`)) return;
    try {
      await deletePasskey(id);
      toast.success("Passkey removida");
      await reload();
    } catch (e: any) {
      toast.error("Erro ao remover", { description: e?.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Passkeys (Beta)
        </CardTitle>
        <CardDescription>
          Entre sem digitar senha usando Face ID, Touch ID ou Windows Hello.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!checked ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !isSupported ? (
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted p-3 text-sm">
            <ShieldOff className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Seu navegador não suporta passkeys. Use Chrome, Safari ou Edge atualizado.
            </span>
          </div>
        ) : (
          <>
            {!hasPlatformAuthenticator && (
              <p className="text-xs text-muted-foreground">
                Este dispositivo não tem biometria configurada. Você ainda pode usar uma chave de segurança externa.
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : passkeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma passkey registrada ainda.</p>
            ) : (
              <ul className="space-y-2">
                {passkeys.map((pk) => (
                  <li
                    key={pk.id}
                    className="flex items-center justify-between rounded-md border border-border/60 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{pk.device_name ?? "Dispositivo"}</p>
                        <p className="text-xs text-muted-foreground">
                          Criada em {new Date(pk.created_at).toLocaleDateString("pt-BR")}
                          {pk.last_used_at && ` · Último uso ${new Date(pk.last_used_at).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(pk.id, pk.device_name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeviceName(defaultName());
                setRegisterOpen(true);
              }}
            >
              <Fingerprint className="h-4 w-4 mr-2" />
              Adicionar passkey
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar passkey</DialogTitle>
            <DialogDescription>
              Dê um nome para identificar este dispositivo na sua lista.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Ex: iPhone do João"
            maxLength={50}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)} disabled={registering}>
              Cancelar
            </Button>
            <Button onClick={handleRegister} disabled={registering}>
              {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Fingerprint className="h-4 w-4 mr-2" />}
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
