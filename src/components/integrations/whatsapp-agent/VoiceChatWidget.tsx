import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function VoiceChatWidget() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We use ElevenLabs Conversational AI via WebRTC
  // This requires @elevenlabs/react - will be available once installed
  const startConversation = useCallback(async () => {
    setStatus("connecting");
    setError(null);

    try {
      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (fnError || !data?.token) {
        throw new Error(data?.error || fnError?.message || "Falha ao obter token de conversa");
      }

      toast.info("Token obtido! Para ativar a conversa por voz, configure o ELEVENLABS_API_KEY e ELEVENLABS_AGENT_ID.");
      setStatus("idle");
    } catch (err: any) {
      console.error("Voice chat error:", err);
      setError(err.message);
      setStatus("idle");
      toast.error(err.message || "Erro ao iniciar conversa por voz");
    }
  }, []);

  const stopConversation = useCallback(() => {
    setStatus("idle");
    setIsSpeaking(false);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="h-4 w-4" /> Chat por Voz
        </CardTitle>
        <CardDescription>
          Converse com o agente por voz usando ElevenLabs Conversational AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-4 py-6">
          {/* Status indicator */}
          <div
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
              status === "idle" && "bg-muted",
              status === "connecting" && "bg-primary/20 animate-pulse",
              status === "connected" && !isSpeaking && "bg-green-500/20",
              status === "connected" && isSpeaking && "bg-green-500/30 animate-pulse"
            )}
          >
            {status === "connected" ? (
              isSpeaking ? (
                <Volume2 className="h-10 w-10 text-green-600" />
              ) : (
                <Mic className="h-10 w-10 text-green-600" />
              )
            ) : (
              <MicOff className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {status === "idle" && "Clique para iniciar uma conversa por voz"}
            {status === "connecting" && "Conectando..."}
            {status === "connected" && !isSpeaking && "Ouvindo... fale agora"}
            {status === "connected" && isSpeaking && "Agente falando..."}
          </p>

          {error && (
            <p className="text-xs text-destructive text-center max-w-sm">{error}</p>
          )}

          {status === "idle" ? (
            <Button
              onClick={startConversation}
              className="gap-2"
              size="lg"
            >
              <Phone className="h-4 w-4" /> Iniciar Conversa
            </Button>
          ) : (
            <Button
              onClick={stopConversation}
              variant="destructive"
              className="gap-2"
              size="lg"
            >
              <PhoneOff className="h-4 w-4" /> Encerrar
            </Button>
          )}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Requisitos:</strong> Configure os segredos <code>ELEVENLABS_API_KEY</code> e{" "}
            <code>ELEVENLABS_AGENT_ID</code> no Supabase para ativar a conversa por voz.
            O Agent ID é criado no painel da ElevenLabs em{" "}
            <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener" className="underline">
              Conversational AI
            </a>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
