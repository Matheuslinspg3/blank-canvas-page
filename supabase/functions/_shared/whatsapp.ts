
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const parseJsonSafely = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const classifyConnectionStatus = (
  ...values: unknown[]
): "connected" | "connecting" | "disconnected" | "unknown" => {
  const text = values
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!text) return "unknown";
  if (/(^|[^a-z])(open|connected|online|ready)([^a-z]|$)/.test(text)) return "connected";
  if (/(connecting|pairing|pair|qr|qrcode|scan|await|starting|sync|opening)/.test(text)) return "connecting";
  if (/(disconnected|close|closed|logout|logged.?out|offline|removed|delete|404)/.test(text)) return "disconnected";
  return "unknown";
};

export const extractQrBase64 = (payload: any): string | null => {
  const candidates = [
    payload?.qrcode?.base64,
    payload?.data?.qrcode?.base64,
    payload?.response?.qrcode?.base64,
    payload?.base64,
    payload?.data?.base64,
    payload?.response?.base64,
    payload?.qrCode,
    payload?.data?.qrCode,
    payload?.qr_code,
    payload?.data?.qr_code,
    payload?.qrcode,
    payload?.data?.qrcode,
    payload?.qrcode?.code,
    payload?.data?.qrcode?.code,
    payload?.qr,
    payload?.data?.qr,
  ];

  for (const candidate of candidates) {
    let val = candidate;
    if (typeof val === "object" && val !== null) {
      val = val.base64 || val.code || val.qr || null;
    }
    if (typeof val !== "string") continue;
    const normalized = val.trim();
    if (normalized.length > 100) return normalized;
  }
  return null;
};

export const extractPairingCode = (payload: any): string | null => {
  const candidates = [
    payload?.pairingCode,
    payload?.pairing_code,
    payload?.code,
    payload?.data?.pairingCode,
    payload?.data?.pairing_code,
    payload?.data?.code,
    payload?.response?.pairingCode,
    payload?.response?.pairing_code,
    payload?.response?.code,
    payload?.qrcode?.pairingCode,
    payload?.data?.qrcode?.pairingCode,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (!normalized || normalized.startsWith("data:image") || normalized.length > 32) continue;
    return normalized;
  }
  return null;
};

export const extractPhoneNumber = (payload: any): string | null => {
  const candidates = [
    payload?.phone,
    payload?.number,
    payload?.phoneNumber,
    payload?.instance?.phone,
    payload?.instance?.number,
    payload?.instance?.phoneNumber,
    payload?.data?.phone,
    payload?.data?.number,
    payload?.data?.phoneNumber,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const digits = String(candidate).replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  return null;
};

export const safePreview = (value: unknown, limit = 1000) => {
  const text = String(value ?? "");
  if (/prismaRepository|integrationSession|findFirst|\/evolution\/dist\/main\.js/i.test(text)) {
    return "[Evolution internal error redacted]";
  }
  const masked = text
    .replace(/("?(?:apikey|api_key|token|authorization)"?\s*[:=]\s*")([^"\n]+)(")/gi, '$1***$3')
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1***');
  return masked.substring(0, limit);
};
