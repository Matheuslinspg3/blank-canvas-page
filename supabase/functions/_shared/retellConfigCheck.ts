// Validação central da configuração Retell por organização.

export type RetellConfigCheck = { ok: true } | { ok: false; reason: string };

export function validateRetellConfig(cfg: any): RetellConfigCheck {
  if (!cfg) return { ok: false, reason: "config_not_found" };
  if (!cfg.enabled) return { ok: false, reason: "integration_disabled" };
  if (!cfg.auto_outbound_enabled) return { ok: false, reason: "auto_outbound_disabled" };
  if (!cfg.agent_id) return { ok: false, reason: "missing_agent_id" };
  if (!cfg.retell_from_number) return { ok: false, reason: "missing_from_number" };
  return { ok: true };
}

// Versão para chamadas manuais (não exige auto_outbound_enabled)
export function validateRetellManualCall(cfg: any): RetellConfigCheck {
  if (!cfg) return { ok: false, reason: "config_not_found" };
  if (!cfg.agent_id) return { ok: false, reason: "missing_agent_id" };
  if (!cfg.retell_from_number) return { ok: false, reason: "missing_from_number" };
  return { ok: true };
}
