import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Loader2, Phone, Clock, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VoiceCall {
  id: string;
  call_id: string;
  agent_id: string;
  call_type: string;
  call_status: string;
  duration_ms: number | null;
  transcript: string | null;
  recording_url: string | null;
  sentiment: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  lead_id: string | null;
}

export function RetellCallHistory() {
  const { profile } = useAuth();
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.organization_id) return;
    const fetchCalls = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("voice_calls" as any)
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setCalls(data as any as VoiceCall[]);
      }
      setLoading(false);
    };
    fetchCalls();
  }, [profile?.organization_id]);

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      registered: { variant: "outline", label: "Registrada" },
      in_progress: { variant: "default", label: "Em andamento" },
      ended: { variant: "secondary", label: "Encerrada" },
      analyzed: { variant: "default", label: "Analisada" },
    };
    const v = variants[status] ?? { variant: "outline" as const, label: status };
    return <Badge variant={v.variant}>{v.label}</Badge>;
  };

  const sentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    const colors: Record<string, string> = {
      positive: "bg-green-500/20 text-green-700",
      negative: "bg-red-500/20 text-red-700",
      neutral: "bg-muted text-muted-foreground",
    };
    return (
      <Badge variant="outline" className={colors[sentiment] ?? ""}>
        {sentiment === "positive" ? "Positivo" : sentiment === "negative" ? "Negativo" : "Neutro"}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Chamadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma chamada registrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <div
                key={call.id}
                className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {call.call_id.slice(0, 12)}...
                    </span>
                    {statusBadge(call.call_status)}
                    {sentimentBadge(call.sentiment)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(call.duration_ms)}
                    </span>
                    <span>
                      {call.started_at
                        ? format(new Date(call.started_at), "dd/MM HH:mm", { locale: ptBR })
                        : format(new Date(call.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    {call.transcript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {expandedId === call.id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {expandedId === call.id && call.transcript && (
                  <div className="mt-3 p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {call.transcript}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
