import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const HEADER = `<tr><td style="background:#1e3a5f;padding:32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;font-family:Inter,Arial,sans-serif;">Porta do Corretor</h1>
      <p style="color:#cbd5e1;margin:6px 0 0;font-size:13px;font-family:Inter,Arial,sans-serif;">Plataforma Imobiliária</p>
    </td></tr>`;

const FOOTER = `<tr><td style="background:#f0f0f0;padding:16px;text-align:center;border-top:2px solid #f97316;">
      <p style="color:#9ca3af;font-size:12px;margin:0;font-family:Inter,Arial,sans-serif;">© 2026 Porta do Corretor — Todos os direitos reservados</p>
    </td></tr>`;

const wrap = (body: string) =>
  `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
  ${HEADER}
  <tr><td style="padding:32px;font-family:Inter,Arial,sans-serif;">
    ${body}
  </td></tr>
  ${FOOTER}
</table>
</td></tr>
</table>
</body>
</html>`;

const btn = (label: string, href: string) =>
  `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 0;">
      <a href="${href}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px;font-family:Inter,Arial,sans-serif;">${label}</a>
    </td></tr></table>`;

const templates: { name: string; description: string; html: string }[] = [
  {
    name: "Confirm Sign Up (OTP)",
    description: "E-mail de confirmação de cadastro com código OTP de 6 dígitos.",
    html: wrap(`<h2 style="color:#1e3a5f;margin:0 0 8px;font-size:22px;">Confirme seu cadastro</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 20px;font-size:15px;">Use o código abaixo para confirmar sua conta:</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <div style="display:inline-block;background:#f0f0f0;padding:18px 36px;border-radius:10px;font-size:32px;font-weight:bold;letter-spacing:4px;color:#1e3a5f;font-family:monospace;">{{ .Token }}</div>
    </td></tr></table>
    <p style="color:#6b7280;font-size:13px;margin:20px 0 0;line-height:1.5;">Este código expira em 24 horas.</p>`),
  },
  {
    name: "Invite User",
    description: "E-mail de convite para novos usuários.",
    html: wrap(`<h2 style="color:#1e3a5f;margin:0 0 8px;font-size:22px;">Você foi convidado!</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;font-size:15px;">Você foi convidado para fazer parte do Porta do Corretor. Clique no botão abaixo para aceitar o convite.</p>
    ${btn("Aceitar Convite", "{{ .ConfirmationURL }}")}`),
  },
  {
    name: "Magic Link",
    description: "Link de acesso rápido sem senha.",
    html: wrap(`<h2 style="color:#1e3a5f;margin:0 0 8px;font-size:22px;">Seu link de acesso</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;font-size:15px;">Clique no botão abaixo para acessar sua conta. Este link é válido por tempo limitado.</p>
    ${btn("Acessar Minha Conta", "{{ .ConfirmationURL }}")}`),
  },
  {
    name: "Reset Password",
    description: "E-mail de redefinição de senha.",
    html: wrap(`<h2 style="color:#1e3a5f;margin:0 0 8px;font-size:22px;">Redefinir sua senha</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;font-size:15px;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.</p>
    ${btn("Redefinir Senha", "{{ .ConfirmationURL }}")}
    <p style="color:#6b7280;font-size:13px;margin:20px 0 0;line-height:1.5;">⚠️ Se você não solicitou isso, ignore este e-mail. Sua senha permanecerá inalterada.</p>`),
  },
  {
    name: "Change Email Address",
    description: "Confirmação de alteração de e-mail.",
    html: wrap(`<h2 style="color:#1e3a5f;margin:0 0 8px;font-size:22px;">Confirme seu novo e-mail</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;font-size:15px;">Clique no botão abaixo para confirmar a alteração do seu endereço de e-mail.</p>
    ${btn("Confirmar Novo E-mail", "{{ .ConfirmationURL }}")}`),
  },
];

function CopyButton({ html }: { html: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    await navigator.clipboard.writeText(html);
    setCopied(true);
    toast({ title: "HTML copiado!", description: "Cole no Supabase Auth → Email Templates." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="gold" size="sm" onClick={copy} className="gap-1.5">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado!" : "Copiar HTML"}
    </Button>
  );
}

export default function EmailTemplates() {
  return (
    <div className="min-h-screen bg-muted/40 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Templates de E-mail</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Copie o HTML de cada template e cole em{" "}
            <strong>Supabase → Authentication → Email Templates</strong>.
          </p>
        </div>

        {templates.map((t) => (
          <Card key={t.name}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{t.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
              </div>
              <CopyButton html={t.html} />
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <iframe
                  srcDoc={t.html}
                  title={t.name}
                  className="w-full border-0"
                  style={{ height: 420 }}
                  sandbox=""
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
