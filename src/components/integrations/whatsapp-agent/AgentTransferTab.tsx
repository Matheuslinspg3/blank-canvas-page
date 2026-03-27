
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, ArrowRightLeft, Plus, X } from "lucide-react";
import { useWhatsAppAgentConfig } from "@/hooks/useWhatsAppAgentConfig";

export function AgentTransferTab() {
  const { config, saveConfig, isSaving, isLoading } = useWhatsAppAgentConfig();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [maxMessages, setMaxMessages] = useState(10);

  useEffect(() => {
    if (config) {
      setKeywords(config.transfer_keywords ?? []);
      setMaxMessages(config.max_messages_before_transfer ?? 10);
    }
  }, [config]);

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw));

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-4 w-4" /> Transferência para Humano
          </CardTitle>
          <CardDescription>
            Configure quando a IA deve transferir a conversa para um corretor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Palavras-chave de transferência</Label>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Ex: falar com corretor"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              />
              <Button variant="outline" onClick={addKeyword} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Se o cliente usar uma dessas palavras, a conversa é transferida.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Máximo de mensagens antes de transferir</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={maxMessages}
              onChange={(e) => setMaxMessages(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Após essa quantidade de mensagens sem resolução, a IA transfere automaticamente.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() =>
            saveConfig({
              transfer_keywords: keywords,
              max_messages_before_transfer: maxMessages,
            })
          }
          disabled={isSaving}
        >
          <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Transferência"}
        </Button>
      </div>
    </div>
  );
}
