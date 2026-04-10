import { useState, useEffect, useCallback } from "react";
import { Sparkles, Plus, Trash2, GripVertical, Loader2, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PillBadge } from "@/components/ui/pill-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface WelcomeMessage {
  id: string;
  message: string;
  position: number;
  is_active: boolean;
  usage_count: number;
}

export function AgentWelcomeTab() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<WelcomeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const orgId = profile?.organization_id;

  const fetchMessages = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_welcome_messages")
      .select("*")
      .eq("organization_id", orgId)
      .order("position", { ascending: true });

    if (!error && data) {
      setMessages(data as WelcomeMessage[]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-generate-welcomes", {});
      if (error) throw error;
      if (data?.messages) {
        setMessages(data.messages);
        toast({ title: "Mensagens geradas!", description: `${data.messages.length} mensagens criadas pela IA.` });
      }
    } catch {
      toast({ title: "Erro", description: "Falha ao gerar mensagens.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const addMessage = async () => {
    if (!orgId) return;
    const newPos = messages.length;
    const { data, error } = await supabase
      .from("whatsapp_welcome_messages")
      .insert({ organization_id: orgId, message: "", position: newPos, is_active: true })
      .select()
      .single();

    if (!error && data) {
      setMessages([...messages, data as WelcomeMessage]);
    }
  };

  const updateMessage = async (id: string, field: Partial<WelcomeMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...field } : m));
  };

  const saveMessage = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    setSaving(true);
    await supabase
      .from("whatsapp_welcome_messages")
      .update({ message: msg.message, is_active: msg.is_active })
      .eq("id", id);
    setSaving(false);
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("whatsapp_welcome_messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const reordered = [...messages];
    const [moved] = reordered.splice(draggedIdx, 1);
    reordered.splice(idx, 0, moved);
    setMessages(reordered);
    setDraggedIdx(idx);
  };

  const handleDragEnd = async () => {
    setDraggedIdx(null);
    // Save new positions
    const updates = messages.map((m, i) =>
      supabase.from("whatsapp_welcome_messages").update({ position: i }).eq("id", m.id)
    );
    await Promise.all(updates);
  };

  const activeCount = messages.filter(m => m.is_active).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Mensagens de Boas-Vindas
            </CardTitle>
            <CardDescription className="mt-1">
              Mensagens enviadas automaticamente para novos contatos. Usadas em ordem rotativa.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <PillBadge size="sm" variant={activeCount > 0 ? "default" : "muted"}>
              {activeCount} ativas
            </PillBadge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={generateWithAI}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {messages.length > 0 ? "Regerar com IA" : "Gerar com IA"}
          </Button>
          <Button variant="outline" size="sm" onClick={addMessage}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={fetchMessages}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-muted-foreground">
          💡 Use <code className="bg-muted px-1 rounded">{"{{nome}}"}</code> para inserir o nome do contato automaticamente. Arraste para reordenar.
        </p>

        {/* Messages list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma mensagem configurada. Clique em "Gerar com IA" para criar automaticamente.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`group flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                  draggedIdx === idx ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                } ${!msg.is_active ? "opacity-50" : ""}`}
              >
                <div className="cursor-grab pt-2 text-muted-foreground hover:text-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>

                <span className="text-xs text-muted-foreground pt-2.5 font-mono w-5 shrink-0">
                  {idx + 1}.
                </span>

                <div className="flex-1 space-y-1.5">
                  <Textarea
                    value={msg.message}
                    onChange={(e) => updateMessage(msg.id, { message: e.target.value })}
                    onBlur={() => saveMessage(msg.id)}
                    placeholder="Digite a mensagem de boas-vindas..."
                    className="min-h-[60px] text-sm resize-none"
                    rows={2}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Enviada {msg.usage_count}x</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 pt-1">
                  <Switch
                    checked={msg.is_active}
                    onCheckedChange={(checked) => {
                      updateMessage(msg.id, { is_active: checked });
                      supabase
                        .from("whatsapp_welcome_messages")
                        .update({ is_active: checked })
                        .eq("id", msg.id)
                        .then();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteMessage(msg.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
