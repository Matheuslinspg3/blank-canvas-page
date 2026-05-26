// Validates a recharge receipt using Lovable AI Gateway (vision).
// Extracts amount, date, pix_key, payer and stores result in
// credit_recharge_requests.receipt_validation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

interface Validation {
  ok: boolean;
  warnings: string[];
  extracted: {
    amount_brl?: number | null;
    date?: string | null;
    pix_key?: string | null;
    payer?: string | null;
    receiver?: string | null;
    raw?: string | null;
  };
  size_bytes?: number;
  mime?: string;
  checked_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return json({ error: "request_id obrigatório" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: reqRow, error: reqErr } = await supabase
      .from("credit_recharge_requests")
      .select("id, amount_brl, pix_key, receipt_path")
      .eq("id", request_id)
      .single();
    if (reqErr || !reqRow) return json({ error: "Solicitação não encontrada" }, 404);
    if (!reqRow.receipt_path) return json({ error: "Sem comprovante anexado" }, 400);

    // Download from storage
    const { data: file, error: dlErr } = await supabase.storage
      .from("recharge-receipts")
      .download(reqRow.receipt_path);
    if (dlErr || !file) return json({ error: "Falha ao baixar comprovante" }, 500);

    const sizeBytes = file.size;
    const mime = file.type || "application/octet-stream";
    const warnings: string[] = [];

    if (sizeBytes > MAX_BYTES) warnings.push(`Arquivo muito grande (${(sizeBytes / 1024 / 1024).toFixed(1)}MB > 5MB)`);
    if (!ALLOWED_MIMES.some((m) => mime.toLowerCase().startsWith(m))) {
      warnings.push(`Tipo de arquivo não permitido: ${mime}`);
    }

    const validation: Validation = {
      ok: false,
      warnings,
      extracted: {},
      size_bytes: sizeBytes,
      mime,
      checked_at: new Date().toISOString(),
    };

    // Only run OCR if image and within size limits
    const isImage = mime.toLowerCase().startsWith("image/");
    if (isImage && sizeBytes <= MAX_BYTES) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        warnings.push("LOVABLE_API_KEY não configurada — OCR ignorado");
      } else {
        try {
          const arrayBuf = await file.arrayBuffer();
          const base64 = base64Encode(new Uint8Array(arrayBuf));
          const dataUrl = `data:${mime};base64,${base64}`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content:
                    "Você analisa comprovantes de PIX brasileiros. Extraia somente o que estiver visível. Retorne JSON puro, sem markdown.",
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text:
                        'Extraia do comprovante: amount_brl (número), date (ISO yyyy-mm-dd se possível), pix_key (string), payer (pagador), receiver (recebedor). Retorne JSON: {"amount_brl":..,"date":..,"pix_key":..,"payer":..,"receiver":..}',
                    },
                    { type: "image_url", image_url: { url: dataUrl } },
                  ],
                },
              ],
              temperature: 0,
            }),
          });

          if (!aiResp.ok) {
            warnings.push(`OCR falhou (HTTP ${aiResp.status})`);
          } else {
            const aiJson = await aiResp.json();
            const raw = aiJson?.choices?.[0]?.message?.content || "";
            validation.extracted.raw = raw;
            const parsed = safeParseJson(raw);
            if (parsed) {
              validation.extracted = { ...validation.extracted, ...parsed };

              // Cross-check declared vs extracted amount
              if (typeof parsed.amount_brl === "number") {
                const diff = Math.abs(parsed.amount_brl - Number(reqRow.amount_brl));
                if (diff > 0.5) {
                  warnings.push(
                    `Valor declarado (R$${Number(reqRow.amount_brl).toFixed(2)}) difere do comprovante (R$${parsed.amount_brl.toFixed(2)})`,
                  );
                }
              } else {
                warnings.push("Não foi possível extrair valor do comprovante");
              }
              // PIX key check
              if (parsed.pix_key && reqRow.pix_key) {
                const a = String(parsed.pix_key).replace(/\D/g, "");
                const b = String(reqRow.pix_key).replace(/\D/g, "");
                if (a && b && a !== b && !a.endsWith(b) && !b.endsWith(a)) {
                  warnings.push(`Chave PIX divergente (esperado ${reqRow.pix_key}, encontrado ${parsed.pix_key})`);
                }
              }
            } else {
              warnings.push("OCR retornou formato inesperado");
            }
          }
        } catch (e) {
          warnings.push(`Erro no OCR: ${(e as Error).message}`);
        }
      }
    } else if (!isImage) {
      warnings.push("OCR automático suportado apenas para imagens (PDF requer análise manual)");
    }

    validation.ok = warnings.length === 0;

    await supabase
      .from("credit_recharge_requests")
      .update({
        receipt_validation: validation as unknown as Record<string, unknown>,
        receipt_mime: mime,
        receipt_size_bytes: sizeBytes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    return json({ success: true, validation });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function safeParseJson(s: string): Record<string, unknown> | null {
  if (!s) return null;
  const cleaned = s.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // deno-lint-ignore no-deprecated-deno-api
  return btoa(binary);
}
