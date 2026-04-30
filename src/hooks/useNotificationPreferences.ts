import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type NotificationEventType =
  | "lead_created"
  | "lead_assigned"
  | "lead_stage_changed"
  | "task_assigned"
  | "task_due_soon"
  | "message_received"
  | "appointment_scheduled";

export interface NotificationPreference {
  id?: string;
  user_id: string;
  event_type: NotificationEventType;
  enabled: boolean;
}

export const NOTIFICATION_EVENTS: { type: NotificationEventType; label: string; description: string }[] = [
  { type: "lead_created", label: "Novo lead recebido", description: "Quando um novo lead entra na organização (visível para administradores)" },
  { type: "lead_assigned", label: "Lead atribuído a mim", description: "Quando um lead é atribuído ao seu nome" },
  { type: "lead_stage_changed", label: "Mudança de estágio do lead", description: "Quando um lead seu muda de etapa no funil" },
  { type: "task_assigned", label: "Tarefa atribuída", description: "Quando uma nova tarefa é atribuída a você" },
  { type: "task_due_soon", label: "Tarefa vencendo", description: "Lembrete de tarefas próximas do prazo" },
  { type: "message_received", label: "Nova mensagem", description: "Mensagens recebidas no WhatsApp ou Inbox" },
  { type: "appointment_scheduled", label: "Compromisso agendado", description: "Visitas e compromissos da agenda" },
];

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = [], isLoading } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("id, user_id, event_type, enabled")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []) as NotificationPreference[];
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const isEnabled = (event: NotificationEventType): boolean => {
    const row = preferences.find((p) => p.event_type === event);
    return row ? row.enabled : true; // default ON
  };

  const setEnabled = useMutation({
    mutationFn: async ({ event, enabled }: { event: NotificationEventType; enabled: boolean }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          { user_id: user.id, event_type: event, enabled },
          { onConflict: "user_id,event_type" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar preferência", description: err.message, variant: "destructive" });
    },
  });

  return {
    preferences,
    isLoading,
    isEnabled,
    setEnabled: (event: NotificationEventType, enabled: boolean) =>
      setEnabled.mutate({ event, enabled }),
    isSaving: setEnabled.isPending,
  };
}
