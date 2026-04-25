import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Send, Paperclip, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSendBrokerMessage } from "@/hooks/whatsapp/useBrokerChat";
import { useBrokerTemplates } from "@/hooks/whatsapp/useBrokerTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  phone: string;
}

export function BrokerChatComposer({ phone }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false); // sync guard against double-fire (Enter + click)
  const lastSubmissionRef = useRef<{ key: string; at: number } | null>(null);
  const { user, profile } = useAuth();
  const { mutateAsync: send, isPending } = useSendBrokerMessage();
  const { templates } = useBrokerTemplates();

  const handleSend = async () => {
    if (sendingRef.current || isPending || sendingNow) return;
    const msg = text.trim();
    if (!msg) return;
    const submissionKey = `${phone}:${msg}`;
    const now = Date.now();
    if (lastSubmissionRef.current?.key === submissionKey && now - lastSubmissionRef.current.at < 5000) return;
    lastSubmissionRef.current = { key: submissionKey, at: now };
    sendingRef.current = true;
    setSendingNow(true);
    setText(""); // clear immediately so the user can type the next message
    try {
      await send({ phone, message: msg, type: "text", clientMessageId: crypto.randomUUID() });
    } catch {
      lastSubmissionRef.current = null;
      setText(msg); // restore so the user doesn't lose their message
    } finally {
      sendingRef.current = false;
      setSendingNow(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      handleSend();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile?.organization_id) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo excede 16MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `broker-chat/${profile.organization_id}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const mediaUrl = pub.publicUrl;

      const mediaType: "image" | "audio" | "document" | "video" = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("audio/")
        ? "audio"
        : file.type.startsWith("video/")
        ? "video"
        : "document";

      await send({
        phone,
        message: text.trim() || file.name,
        type: "media",
        mediaUrl,
        mediaType,
        clientMessageId: crypto.randomUUID(),
      });
      setText("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar mídia");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-card p-3">
      <div className="flex items-end gap-2">
        {/* Templates */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Templates">
              <FileText className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Templates rápidos
            </p>
            {templates.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Nenhum template criado.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setText(t.body)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="block font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.body}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>

        {/* File upload */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || isPending}
          title="Anexar mídia"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFile}
        />

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          rows={1}
          className="min-h-9 max-h-32 resize-none"
        />

        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={isPending || sendingNow || !text.trim()}
        >
          {isPending || sendingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
