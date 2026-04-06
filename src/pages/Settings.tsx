import { lazy, Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Building2, User, Bell, Users, Palette, Sun, Moon, Monitor, Megaphone, CreditCard, History, MessageSquare, Bug, Loader2, Crown } from "lucide-react";
import { SupportTicketDialog } from "@/components/settings/SupportTicketDialog";
import { UserTicketsSection } from "@/components/settings/UserTicketsSection";
import { PlatformInviteSection } from "@/components/settings/PlatformInviteSection";
import { BillingTab } from "@/components/settings/BillingTab";
import { ChangelogSection } from "@/components/settings/ChangelogSection";
import { SettingsProfileTab } from "@/components/settings/SettingsProfileTab";
import { SettingsCompanyTab } from "@/components/settings/SettingsCompanyTab";
import { SettingsTeamTab } from "@/components/settings/SettingsTeamTab";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const WhiteLabelSettings = lazy(() => import("@/components/settings/WhiteLabelSettings"));
const CustomDomainsManager = lazy(() => import("@/components/settings/CustomDomainsManager").then(m => ({ default: m.CustomDomainsManager })));


export default function Settings() {
  const { isAdminOrAbove, isDeveloperOrLeader } = useUserRoles();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col min-h-screen relative page-enter" data-clarity-mask="true">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações do sistema"
        actions={
          <SupportTicketDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <Bug className="h-4 w-4" />
                <span className="hidden sm:inline">Reportar problema</span>
                <span className="sm:hidden">Reportar</span>
              </Button>
            }
          />
        }
      />

      <div className="relative flex-1 p-4 sm:p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto flex-wrap sm:flex-nowrap gap-1 p-1">
              <TabsTrigger value="profile" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><User className="h-4 w-4 shrink-0" /><span>Perfil</span></TabsTrigger>
              <TabsTrigger value="company" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Building2 className="h-4 w-4 shrink-0" /><span>Empresa</span></TabsTrigger>
              {isAdminOrAbove && (
                <TabsTrigger value="team" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Users className="h-4 w-4 shrink-0" /><span>Equipe</span></TabsTrigger>
              )}
              <TabsTrigger value="appearance" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Palette className="h-4 w-4 shrink-0" /><span>Aparência</span></TabsTrigger>
              {isAdminOrAbove && (
                <TabsTrigger value="changelog" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><History className="h-4 w-4 shrink-0" /><span>Histórico</span></TabsTrigger>
              )}
              {isDeveloperOrLeader && (
                <TabsTrigger value="clients" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Megaphone className="h-4 w-4 shrink-0" /><span>Clientes</span></TabsTrigger>
              )}
              {isAdminOrAbove && (
                <TabsTrigger value="billing" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><CreditCard className="h-4 w-4 shrink-0" /><span>Assinatura</span></TabsTrigger>
              )}
              <TabsTrigger value="support" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><MessageSquare className="h-4 w-4 shrink-0" /><span>Suporte</span></TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile"><SettingsProfileTab /></TabsContent>
          <TabsContent value="company"><SettingsCompanyTab /></TabsContent>
          <TabsContent value="team"><SettingsTeamTab /></TabsContent>

          <TabsContent value="appearance">
            <div className="grid gap-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Tema</CardTitle>
                  <CardDescription>Escolha como a interface deve aparecer</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                      { value: 'light', label: 'Claro', icon: Sun, iconClass: 'text-yellow-500', bgClass: 'bg-background border-2' },
                      { value: 'dark', label: 'Escuro', icon: Moon, iconClass: '', bgClass: 'bg-muted border-2' },
                      { value: 'system', label: 'Sistema', icon: Monitor, iconClass: '', bgClass: 'bg-gradient-to-br from-background to-muted border-2' },
                    ] as const).map(t => (
                      <button key={t.value} onClick={() => setTheme(t.value)}
                        className={cn("flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all hover:bg-accent",
                          theme === t.value ? "border-primary bg-accent" : "border-transparent bg-muted/50")}>
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", t.bgClass)}>
                          <t.icon className={cn("h-6 w-6", t.iconClass)} />
                        </div>
                        <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">O tema "Sistema" acompanha automaticamente as configurações do seu dispositivo.</p>
                </CardContent>
              </Card>
              <PushNotificationCard />

              {/* White-Label / Personalização */}
              <Suspense fallback={<div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                <WhiteLabelSettings />
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent value="changelog"><ChangelogSection /></TabsContent>

          {isDeveloperOrLeader && (
            <TabsContent value="clients">
              <div className="grid gap-6 max-w-2xl"><PlatformInviteSection /></div>
            </TabsContent>
          )}

          {isAdminOrAbove && (
            <TabsContent value="billing"><BillingTab /></TabsContent>
          )}

          <TabsContent value="support">
            <div className="grid gap-6 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Meus Tickets</h3>
                  <p className="text-sm text-muted-foreground">Acompanhe seus tickets e converse com o suporte</p>
                </div>
                <SupportTicketDialog />
              </div>
              <UserTicketsSection />
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

function PushNotificationCard() {
  const { isSupported, isSubscribed, isLoading, permission, canFetchToken, subscribe, unsubscribe } = usePushNotifications();
  const isIframe = window.self !== window.top;

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notificações Push</CardTitle>
          <CardDescription>Seu navegador não suporta notificações push.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notificações Push</CardTitle>
        <CardDescription>Receba notificações em tempo real no seu dispositivo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isIframe && (
          <div className="rounded-md border border-border/60 bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              ⚠️ Notificações push não funcionam no modo preview (iframe). Teste na{" "}
              <a href={`${window.location.origin}/configuracoes`} target="_blank" rel="noopener noreferrer" className="underline font-medium">URL publicada</a>.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {isSubscribed ? "Push ativado" : !canFetchToken ? "Notificações inativas" : "Push desativado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {permission === "denied" ? "Permissão bloqueada nas configurações do navegador"
                : isSubscribed ? "Você receberá alertas de novos leads, imóveis e compromissos"
                : !canFetchToken ? "As notificações ainda não foram ativadas neste aparelho."
                : "Ative para ser notificado instantaneamente"}
            </p>
          </div>
          <Switch checked={isSubscribed} disabled={isLoading || permission === "denied" || isIframe}
            onCheckedChange={checked => { if (checked) subscribe(); else unsubscribe(); }} />
        </div>
        {!isSubscribed && !canFetchToken && permission !== "denied" && (
          <div className="rounded-md border border-border/60 bg-muted p-3">
            <p className="text-xs text-muted-foreground">Clique no botão abaixo para receber alertas.</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => subscribe()} disabled={isLoading}>
              Ativar notificações
            </Button>
          </div>
        )}
        {permission === "denied" && (
          <p className="text-xs text-destructive">As notificações estão bloqueadas. Acesse as configurações do navegador.</p>
        )}
      </CardContent>
    </Card>
  );
}
