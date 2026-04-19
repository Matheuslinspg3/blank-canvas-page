// Centraliza a regra de consent_voice_call por origem do lead.
// Mecânica, não jurídica — admins podem sempre sobrescrever via UI.

export function resolveVoiceConsent(opts: {
  source?: string | null;
  explicit?: boolean | null;
  hasPhone: boolean;
}): boolean {
  if (!opts.hasPhone) return false;
  if (typeof opts.explicit === "boolean") return opts.explicit;
  const s = (opts.source || "").toLowerCase();
  if (s.includes("meta") || s === "anuncio") return true;
  if (s.includes("rdstation") || s.includes("rd_station") || s.includes("rd station")) return true;
  if (s === "whatsapp") return true;
  // website, landing_page, site, manual, csv → default false
  return false;
}

// Mascara telefone para logs: +55 11 9****1234
export function maskPhone(p?: string | null): string {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length < 6) return "***";
  return d.slice(0, 4) + "*".repeat(Math.max(0, d.length - 8)) + d.slice(-4);
}
