import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PixQRCodeProps {
  pixKey: string;
  size?: number;
}

export function PixQRCode({ pixKey, size = 200 }: PixQRCodeProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(pixKey);
    setCopied(true);
    toast.success("Chave PIX copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-lg bg-white p-4 shadow-sm">
        <QRCodeSVG value={pixKey} size={size} level="M" />
      </div>
      <div className="flex w-full max-w-xs items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <span className="flex-1 font-mono text-sm">{pixKey}</span>
        <Button size="sm" variant="ghost" onClick={copy} aria-label="Copiar chave PIX">
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tipo: <strong>Celular</strong> · Abra o app do seu banco, escolha PIX, escaneie o QR ou cole a chave.
      </p>
    </div>
  );
}
