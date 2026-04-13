import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, Loader2, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CallStatus = "idle" | "connecting" | "connected" | "speaking" | "ended" | "error";

export function RetellCallWidget() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const retellClientRef = useRef<any>(null);

  const startCall = useCallback(async () => {
    setStatus("connecting");
    try {
      const { data, error } = await supabase.functions.invoke("retell-create-web-call", {
        body: { metadata: {} },
      });

      if (error) throw new Error(error.message);
      if (!data?.access_token) throw new Error("Token não recebido");

      setCallId(data.call_id);

      // Dynamic import of Retell SDK
      const { RetellWebClient } = await import("retell-client-js-sdk");
      const client = new RetellWebClient();
      retellClientRef.current = client;

      client.on("call_started", () => setStatus("connected"));
      client.on("call_ended", () => {
        setStatus("ended");
        retellClientRef.current = null;
        setTimeout(() => setStatus("idle"), 3000);
      });
      client.on("agent_start_talking", () => setStatus("speaking"));
      client.on("agent_stop_talking", () => setStatus("connected"));
      client.on("error", (err: any) => {
        console.error("Retell error:", err);
        setStatus("error");
        toast.error("Erro na chamada");
        setTimeout(() => setStatus("idle"), 3000);
      });

      await client.startCall({ accessToken: data.access_token });
    } catch (err: any) {
      console.error("Start call error:", err);
      toast.error(err.message || "Erro ao iniciar chamada");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, []);

  const endCall = useCallback(() => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
      retellClientRef.current = null;
    }
    setStatus("ended");
    setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const toggleMute = useCallback(() => {
    if (retellClientRef.current) {
      if (isMuted) {
        retellClientRef.current.unmute();
      } else {
        retellClientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const statusConfig: Record<CallStatus, { label: string; color: string; pulse?: boolean }> = {
    idle: { label: "Pronto", color: "bg-muted text-muted-foreground" },
    connecting: { label: "Conectando...", color: "bg-yellow-500/20 text-yellow-600", pulse: true },
    connected: { label: "Em chamada", color: "bg-green-500/20 text-green-600", pulse: true },
    speaking: { label: "Agente falando", color: "bg-blue-500/20 text-blue-600", pulse: true },
    ended: { label: "Chamada encerrada", color: "bg-muted text-muted-foreground" },
    error: { label: "Erro", color: "bg-destructive/20 text-destructive" },
  };

  const currentStatus = statusConfig[status];
  const isInCall = status === "connected" || status === "speaking" || status === "connecting";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Chamada Web
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 py-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                currentStatus.pulse ? "animate-pulse" : ""
              } ${status === "connected" || status === "speaking" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500" : status === "error" ? "bg-destructive" : "bg-muted-foreground"}`}
            />
            <Badge variant="outline" className={currentStatus.color}>
              {currentStatus.label}
            </Badge>
            {callId && isInCall && (
              <span className="text-xs text-muted-foreground">ID: {callId.slice(0, 8)}...</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {!isInCall ? (
              <Button
                size="lg"
                onClick={startCall}
                disabled={status === "ended"}
                className="gap-2"
              >
                {status === "ended" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Phone className="h-5 w-5" />
                )}
                Iniciar Chamada
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleMute}
                  title={isMuted ? "Desmutar" : "Mutar"}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button variant="destructive" size="lg" onClick={endCall} className="gap-2">
                  <PhoneOff className="h-5 w-5" />
                  Encerrar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
