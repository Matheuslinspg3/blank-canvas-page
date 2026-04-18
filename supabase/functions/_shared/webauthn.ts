/**
 * Constantes compartilhadas para o fluxo WebAuthn / passkeys.
 * RP ID = apex domain do app. Passkeys funcionam em qualquer subdomínio do RP ID.
 */
export const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") ?? "portadocorretor.com.br";
export const RP_NAME = Deno.env.get("WEBAUTHN_RP_NAME") ?? "Porta do Corretor";

/** Origens aceitas durante a verificação de attestation/assertion. */
export const EXPECTED_ORIGINS = [
  `https://${RP_ID}`,
  `https://www.${RP_ID}`,
  // Preview / dev
  "http://localhost:5173",
  "http://localhost:8080",
];
