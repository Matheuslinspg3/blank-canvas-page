import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, GripVertical, Save, Loader2, Upload, MessageSquare,
  PhoneOff, Globe, ChevronDown, ChevronUp, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FlowEdge {
  destination_node_id: string;
  condition: string;
}

interface FlowStep {
  id?: string;
  node_id: string;
  node_type: "conversation" | "end_call";
  label: string;
  instruction_text: string;
  position: number;
  edges: FlowEdge[];
  is_global: boolean;
}

const DEFAULT_STEPS: FlowStep[] = [
  {
    node_id: "greeting",
    node_type: "conversation",
    label: "Saudação",
    instruction_text: "Cumprimente o cliente pelo nome e apresente-se como corretor da imobiliária. Pergunte como pode ajudar.",
    position: 0,
    edges: [{ destination_node_id: "confirm", condition: "O usuário respondeu e mostrou interesse" }],
    is_global: false,
  },
  {
    node_id: "confirm",
    node_type: "conversation",
    label: "Confirmação",
    instruction_text: "Confirme o interesse do cliente em imóveis. Mencione que trabalha com opções na região e pergunte se ele já pesquisou antes.",
    position: 1,
    edges: [
      { destination_node_id: "collect_info", condition: "O cliente confirmou interesse" },
      { destination_node_id: "handle_no_interest", condition: "O cliente não tem interesse ou está hesitante" },
    ],
    is_global: false,
  },
  {
    node_id: "collect_info",
    node_type: "conversation",
    label: "Coleta de Dados",
    instruction_text: "Faça perguntas abertas para entender as necessidades: tipo de imóvel, região, orçamento, prazo e motivação da compra.",
    position: 2,
    edges: [{ destination_node_id: "establish_interest", condition: "O cliente forneceu informações suficientes" }],
    is_global: false,
  },
  {
    node_id: "establish_interest",
    node_type: "conversation",
    label: "Apresentar Solução",
    instruction_text: "Com base nas informações coletadas, apresente brevemente como pode ajudar. Mencione diferenciais e proponha agendar uma visita.",
    position: 3,
    edges: [{ destination_node_id: "end_call", condition: "O cliente aceitou ou respondeu" }],
    is_global: false,
  },
  {
    node_id: "handle_no_interest",
    node_type: "conversation",
    label: "Sem Interesse",
    instruction_text: "Agradeça o tempo do cliente. Diga que pode entrar em contato futuramente. Encerre educadamente.",
    position: 4,
    edges: [{ destination_node_id: "end_call", condition: "Encerrar chamada" }],
    is_global: false,
  },
  {
    node_id: "end_call",
    node_type: "end_call",
    label: "Encerrar Chamada",
    instruction_text: "",
    position: 5,
    edges: [],
    is_global: false,
  },
  {
    node_id: "global",
    node_type: "conversation",
    label: "Nó Global",
    instruction_text: "Você é um assistente de vendas imobiliárias profissional, educado e persuasivo. Sempre trate o cliente pelo nome quando disponível.",
    position: 99,
    edges: [],
    is_global: true,
  },
];

export function RetellFlowEditor() {
  const { profile } = useAuth();
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load steps from database
  useEffect(() => {
    if (!profile?.organization_id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("retell_flow_steps" as any)
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("position", { ascending: true });

      if (!error && data && (data as any[]).length > 0) {
        setSteps((data as any[]).map((d: any) => ({
          id: d.id,
          node_id: d.node_id,
          node_type: d.node_type,
          label: d.label,
          instruction_text: d.instruction_text,
          position: d.position,
          edges: d.edges || [],
          is_global: d.is_global,
        })));
      } else {
        setSteps(DEFAULT_STEPS);
      }
      setLoading(false);
    };
    load();
  }, [profile?.organization_id]);

  const regularSteps = steps.filter((s) => !s.is_global).sort((a, b) => a.position - b.position);
  const globalStep = steps.find((s) => s.is_global);

  const updateStep = (nodeId: string, updates: Partial<FlowStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.node_id === nodeId ? { ...s, ...updates } : s))
    );
  };

  const addStep = () => {
    const maxPos = Math.max(...regularSteps.map((s) => s.position), -1);
    const newId = `step_${Date.now()}`;
    setSteps((prev) => [
      ...prev,
      {
        node_id: newId,
        node_type: "conversation",
        label: "Nova Etapa",
        instruction_text: "",
        position: maxPos + 1,
        edges: [],
        is_global: false,
      },
    ]);
    setExpandedId(newId);
  };

  const removeStep = (nodeId: string) => {
    // Also remove edges pointing to this node
    setSteps((prev) =>
      prev
        .filter((s) => s.node_id !== nodeId)
        .map((s) => ({
          ...s,
          edges: s.edges.filter((e) => e.destination_node_id !== nodeId),
        }))
    );
  };

  const moveStep = (nodeId: string, direction: "up" | "down") => {
    const idx = regularSteps.findIndex((s) => s.node_id === nodeId);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === regularSteps.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newSteps = [...steps];
    const a = newSteps.find((s) => s.node_id === regularSteps[idx].node_id)!;
    const b = newSteps.find((s) => s.node_id === regularSteps[swapIdx].node_id)!;
    const tmpPos = a.position;
    a.position = b.position;
    b.position = tmpPos;
    setSteps(newSteps);
  };

  const addEdge = (nodeId: string) => {
    updateStep(nodeId, {
      edges: [
        ...(steps.find((s) => s.node_id === nodeId)?.edges || []),
        { destination_node_id: "", condition: "" },
      ],
    });
  };

  const updateEdge = (nodeId: string, edgeIdx: number, updates: Partial<FlowEdge>) => {
    const step = steps.find((s) => s.node_id === nodeId);
    if (!step) return;
    const newEdges = [...step.edges];
    newEdges[edgeIdx] = { ...newEdges[edgeIdx], ...updates };
    updateStep(nodeId, { edges: newEdges });
  };

  const removeEdge = (nodeId: string, edgeIdx: number) => {
    const step = steps.find((s) => s.node_id === nodeId);
    if (!step) return;
    updateStep(nodeId, { edges: step.edges.filter((_, i) => i !== edgeIdx) });
  };

  const handleSave = async () => {
    if (!profile?.organization_id) return;
    setSaving(true);
    try {
      // Delete existing steps
      await supabase
        .from("retell_flow_steps" as any)
        .delete()
        .eq("organization_id", profile.organization_id);

      // Insert all steps
      const inserts = steps.map((s) => ({
        organization_id: profile.organization_id,
        node_id: s.node_id,
        node_type: s.node_type,
        label: s.label,
        instruction_text: s.instruction_text,
        position: s.position,
        edges: s.edges,
        is_global: s.is_global,
      }));

      const { error } = await supabase
        .from("retell_flow_steps" as any)
        .insert(inserts as any);

      if (error) throw error;
      toast.success("Flow salvo com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("retell-sync-flow");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Flow sincronizado! ${data.nodes_count} nós enviados à Retell.`);
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const nodeTypeIcon = (type: string) => {
    if (type === "end_call") return <PhoneOff className="h-4 w-4 text-destructive" />;
    return <MessageSquare className="h-4 w-4 text-primary" />;
  };

  const nodeTypeLabel = (type: string) => {
    if (type === "end_call") return "Encerrar";
    return "Conversa";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global Node */}
      {globalStep && (
        <Card className="border-dashed border-primary/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Nó Global (aplicado a todas as etapas)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Textarea
              value={globalStep.instruction_text}
              onChange={(e) => updateStep("global", { instruction_text: e.target.value })}
              rows={3}
              placeholder="Instruções globais do agente..."
              className="text-sm"
            />
          </CardContent>
        </Card>
      )}

      {/* Flow Steps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Etapas do Conversation Flow</CardTitle>
              <CardDescription>
                Defina a sequência de etapas da chamada. Cada etapa tem uma instrução e transições.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" /> Etapa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {regularSteps.map((step, idx) => {
            const isExpanded = expandedId === step.node_id;
            return (
              <div
                key={step.node_id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex items-center gap-2 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : step.node_id)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="shrink-0 gap-1">
                    {nodeTypeIcon(step.node_type)}
                    {nodeTypeLabel(step.node_type)}
                  </Badge>
                  <span className="font-medium text-sm flex-1 truncate">{step.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {step.edges.length} transição(ões)
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => { e.stopPropagation(); moveStep(step.node_id, "up"); }}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => { e.stopPropagation(); moveStep(step.node_id, "down"); }}
                      disabled={idx === regularSteps.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    {step.node_type !== "end_call" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeStep(step.node_id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome da etapa</Label>
                        <Input
                          value={step.label}
                          onChange={(e) => updateStep(step.node_id, { label: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={step.node_type}
                          onValueChange={(v) => updateStep(step.node_id, { node_type: v as any })}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conversation">Conversa</SelectItem>
                            <SelectItem value="end_call">Encerrar Chamada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {step.node_type !== "end_call" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Instrução do agente</Label>
                        <Textarea
                          value={step.instruction_text}
                          onChange={(e) => updateStep(step.node_id, { instruction_text: e.target.value })}
                          rows={3}
                          placeholder="O que o agente deve fazer nesta etapa..."
                          className="text-sm"
                        />
                      </div>
                    )}

                    {/* Edges / Transitions */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Transições</Label>
                        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => addEdge(step.node_id)}>
                          <Plus className="h-3 w-3 mr-1" /> Transição
                        </Button>
                      </div>
                      {step.edges.map((edge, edgeIdx) => (
                        <div key={edgeIdx} className="flex items-start gap-2 p-2 bg-muted/30 rounded">
                          <ArrowRight className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <Input
                              value={edge.condition}
                              onChange={(e) => updateEdge(step.node_id, edgeIdx, { condition: e.target.value })}
                              placeholder="Condição (ex: O cliente mostrou interesse)"
                              className="text-xs"
                            />
                            <Select
                              value={edge.destination_node_id}
                              onValueChange={(v) => updateEdge(step.node_id, edgeIdx, { destination_node_id: v })}
                            >
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Destino..." />
                              </SelectTrigger>
                              <SelectContent>
                                {steps
                                  .filter((s) => s.node_id !== step.node_id && !s.is_global)
                                  .map((s) => (
                                    <SelectItem key={s.node_id} value={s.node_id}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive shrink-0 mt-1"
                            onClick={() => removeEdge(step.node_id, edgeIdx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Flow
        </Button>
        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Sincronizar com Retell
        </Button>
      </div>
    </div>
  );
}
