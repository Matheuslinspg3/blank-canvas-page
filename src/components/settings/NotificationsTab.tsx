import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, Loader2, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationPreferences, NOTIFICATION_EVENTS } from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationsTab() {
  const { isEnabled, setEnabled, isLoading, isSaving } = useNotificationPreferences();
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, isLoading: pushLoading } = usePushNotifications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push channel control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notificações push do navegador
          </CardTitle>
          <CardDescription>
            Receba alertas mesmo com o app fechado. As notificações dentro do app continuam funcionando independente desta opção.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isSupported && (
            <p className="text-sm text-muted-foreground">
              Seu navegador não suporta notificações push.
            </p>
          )}
          {isSupported && permission === "denied" && (
            <p className="text-sm text-destructive">
              As notificações foram bloqueadas. Permita-as nas configurações do navegador.
            </p>
          )}
          {isSupported && permission !== "denied" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isSubscribed ? "Notificações push ativadas" : "Notificações push desativadas"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed
                    ? "Você receberá alertas no navegador conforme as preferências abaixo."
                    : "Ative para receber alertas em tempo real."}
                </p>
              </div>
              <Button
                size="sm"
                variant={isSubscribed ? "outline" : "default"}
                disabled={pushLoading}
                onClick={async () => {
                  if (isSubscribed) await unsubscribe();
                  else await subscribe();
                }}
              >
                {pushLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSubscribed ? (
                  <><BellOff className="h-4 w-4 mr-2" /> Desativar</>
                ) : (
                  <><Bell className="h-4 w-4 mr-2" /> Ativar</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-event preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos de notificação</CardTitle>
          <CardDescription>
            Escolha quais eventos devem gerar uma notificação para você (in-app e push, quando ativados).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {NOTIFICATION_EVENTS.map((evt, idx) => {
            const checked = isEnabled(evt.type);
            return (
              <div key={evt.type}>
                {idx > 0 && <Separator className="my-1" />}
                <div className="flex items-start justify-between gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`notif-${evt.type}`} className="text-sm font-medium cursor-pointer">
                      {evt.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                  </div>
                  <Switch
                    id={`notif-${evt.type}`}
                    checked={checked}
                    disabled={isSaving}
                    onCheckedChange={(v) => setEnabled(evt.type, v)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
