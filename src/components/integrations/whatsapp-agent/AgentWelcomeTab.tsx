import { useState, useEffect, useCallback } from "react";
import { Sparkles, Plus, Trash2, GripVertical, Loader2, RefreshCw, TestTube, Image, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PillBadge } from "@/components/ui/pill-badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";
import { toast } from "@/hooks/use-toast";

interface WelcomeMessage {
  id: string;
  message: string;
  position: number;
  is_active: boolean;
  usage_count: number;
  time_period: string;
  media_url: string | null;
  media_type: string | null;
  target_audience: string;
  campaign_tag: string | null;
  reply_count: number;
  reply_rate: number;
}

const TIME_LABELS: Record<string, string> = { all: "Todos", morning: "Manhã", afternoon: "Tarde", night: "Noite" };
const AUDIENCE_LABELS: Record<string, string> = { all: "Todos", new_only: "Novos", leads_only: "Leads" };

export function AgentWelcomeTab() {
  const { profile } = useAuth();
  const { config, saveConfig } = useWhatsAppAgentConfig();
  const [messages, setMessages] = useState<WelcomeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const orgId = profile?.organization_id;

  const fetchMessages = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_welcome_messages")
      .select("*")
      .eq("organization_id", orgId)
      .order("position", { ascending: true });
    if (!error && data) setMessages(data as any as WelcomeMessage[]);
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
    if (!orgId) {
      toast({ title: "Erro", description: "Organização não encontrada.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("whatsapp_welcome_messages")
      .insert({
        organization_id: orgId,
        message: "Olá {{nome}}! 👋 Como posso ajudar?",
        position: messages.length,
        is_active: true,
        time_period: "all",
        target_audience: "all",
      } as any)
      .select()
      .single();
    if (error) {
      console.error("addMessage error:", error);
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      setMessages([...messages, data as any as WelcomeMessage]);
      toast({ title: "Mensagem adicionada!", description: "Edite o texto e salve." });
    }
  };

  const updateMessage = (id: string, field: Partial<WelcomeMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...field } : m));
  };

  const saveField = async (id: string, field: Partial<WelcomeMessage>) => {
    await supabase.from("whatsapp_welcome_messages").update(field as any).eq("id", id);
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
    await Promise.all(messages.map((m, i) =>
      supabase.from("whatsapp_welcome_messages").update({ position: i } as any).eq("id", m.id)
    ));
  };

  const testWelcome = async () => {
    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-get-welcome", {
        body: { instance_name: config?.instance_name || "test", phone: "5511999990000@s.whatsapp.net", contact_name: "João Teste", is_lead: false },
      });
      if (error) throw error;
      setPreviewData(data);
      setPreviewOpen(true);
    } catch {
      toast({ title: "Erro", description: "Falha ao testar.", variant: "destructive" });
    } finally {
      setTestLoading(false);
    }
  };

  const activeCount = messages.filter(m => m.is_active).length;

  return (
    <div className="space-y-4">
      {/* Global Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚙️ Configurações Globais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Delay mínimo (s)</Label>
              <Input
                type="number" min={0} max={30}
                value={config?.welcome_delay_min ?? 3}
                onChange={e => saveConfig({ welcome_delay_min: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Delay máximo (s)</Label>
              <Input
                type="number" min={0} max={60}
                value={config?.welcome_delay_max ?? 8}
                onChange={e => saveConfig({ welcome_delay_max: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={config?.welcome_ab_test ?? false}
                onCheckedChange={checked => saveConfig({ welcome_ab_test: checked })}
              />
              <Label className="text-xs">A/B Testing inteligente</Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Com A/B Testing ativo, mensagens com maior taxa de resposta são priorizadas automaticamente.
          </p>
        </CardContent>
      </Card>

      {/* Messages Card */}
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
            <PillBadge size="sm" variant={activeCount > 0 ? "default" : "muted"}>
              {activeCount} ativas
            </PillBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="default" size="sm" onClick={generateWithAI} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {messages.length > 0 ? "Regerar com IA" : "Gerar com IA"}
            </Button>
            <Button variant="outline" size="sm" onClick={addMessage}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <Button variant="outline" size="sm" onClick={testWelcome} disabled={testLoading}>
              {testLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TestTube className="h-4 w-4 mr-1" />}
              Testar
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={fetchMessages}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Use <code className="bg-muted px-1 rounded">{"{{nome}}"}</code> para inserir o nome do contato. Arraste para reordenar.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma mensagem configurada. Clique em "Gerar com IA" para criar automaticamente.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <MessageCard
                  key={msg.id}
                  msg={msg}
                  idx={idx}
                  draggedIdx={draggedIdx}
                  onUpdate={updateMessage}
                  onSave={saveField}
                  onDelete={deleteMessage}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Preview da Mensagem</DialogTitle>
          </DialogHeader>
          {previewData ? (
            <div className="space-y-3">
              <div className="bg-[#DCF8C6] rounded-lg p-3 text-sm text-gray-900 max-w-[85%] ml-auto shadow-sm">
                {previewData.message || "Nenhuma mensagem retornada"}
              </div>
              {previewData.media_url && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Image className="h-3 w-3" /> Mídia: {previewData.media_type} — {previewData.media_url.slice(0, 40)}...
                </div>
              )}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>⏱ Delay: {previewData.delay_seconds}s</p>
                {previewData.reason && <p>ℹ️ Razão: {previewData.reason}</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Subcomponent for each message card ──
interface MessageCardProps {
  msg: WelcomeMessage;
  idx: number;
  draggedIdx: number | null;
  onUpdate: (id: string, field: Partial<WelcomeMessage>) => void;
  onSave: (id: string, field: Partial<WelcomeMessage>) => Promise<void>;
  onDelete: (id: string) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
}

function MessageCard({ msg, idx, draggedIdx, onUpdate, onSave, onDelete, onDragStart, onDragOver, onDragEnd }: MessageCardProps) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={(e) => onDragOver(e, idx)}
      onDragEnd={onDragEnd}
      className={`group p-3 rounded-lg border transition-colors ${
        draggedIdx === idx ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
      } ${!msg.is_active ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="cursor-grab pt-2 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <span className="text-xs text-muted-foreground pt-2.5 font-mono w-5 shrink-0">{idx + 1}.</span>

        <div className="flex-1 space-y-2">
          <Textarea
            value={msg.message}
            onChange={e => onUpdate(msg.id, { message: e.target.value })}
            onBlur={() => onSave(msg.id, { message: msg.message })}
            placeholder="Digite a mensagem de boas-vindas..."
            className="min-h-[60px] text-sm resize-none"
            rows={2}
          />

          {/* Metrics row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>Enviada {msg.usage_count}x</span>
            <span>💬 {msg.reply_count} respostas</span>
            <span className={msg.reply_rate > 30 ? "text-green-600 font-medium" : ""}>
              📊 {msg.reply_rate?.toFixed(1) ?? 0}%
            </span>
            <button className="underline hover:text-foreground" onClick={() => setShowOptions(!showOptions)}>
              {showOptions ? "Menos opções" : "Mais opções"}
            </button>
          </div>

          {/* Expandable options */}
          {showOptions && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Período</Label>
                <Select
                  value={msg.time_period || "all"}
                  onValueChange={v => { onUpdate(msg.id, { time_period: v }); onSave(msg.id, { time_period: v }); }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIME_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Audiência</Label>
                <Select
                  value={msg.target_audience || "all"}
                  onValueChange={v => { onUpdate(msg.id, { target_audience: v }); onSave(msg.id, { target_audience: v }); }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Tag Campanha</Label>
                <Input
                  className="h-8 text-xs"
                  value={msg.campaign_tag || ""}
                  onChange={e => onUpdate(msg.id, { campaign_tag: e.target.value })}
                  onBlur={() => onSave(msg.id, { campaign_tag: msg.campaign_tag })}
                  placeholder="ex: facebook_ad"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">URL Mídia</Label>
                <div className="flex gap-1">
                  <Input
                    className="h-8 text-xs flex-1"
                    value={msg.media_url || ""}
                    onChange={e => onUpdate(msg.id, { media_url: e.target.value })}
                    onBlur={() => onSave(msg.id, { media_url: msg.media_url, media_type: msg.media_url ? (msg.media_type || "image") : null })}
                    placeholder="https://..."
                  />
                  {msg.media_url && (
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                      onClick={() => { onUpdate(msg.id, { media_url: null, media_type: null }); onSave(msg.id, { media_url: null, media_type: null }); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              {msg.media_url && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Tipo Mídia</Label>
                  <Select
                    value={msg.media_type || "image"}
                    onValueChange={v => { onUpdate(msg.id, { media_type: v }); onSave(msg.id, { media_type: v }); }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 pt-1">
          <Switch
            checked={msg.is_active}
            onCheckedChange={checked => {
              onUpdate(msg.id, { is_active: checked });
              supabase.from("whatsapp_welcome_messages").update({ is_active: checked } as any).eq("id", msg.id).then();
            }}
          />
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(msg.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
