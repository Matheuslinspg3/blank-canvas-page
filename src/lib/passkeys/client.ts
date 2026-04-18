/**
 * Helpers de cliente para WebAuthn / passkeys.
 * Wrappers em torno de navigator.credentials.create/get com encoding base64url
 * e chamadas às edge functions.
 */
import { supabase } from "@/integrations/supabase/client";

// ============ base64url helpers ============
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ============ Registro ============
export async function registerPasskey(deviceName: string): Promise<void> {
  // 1. Pedir options ao backend
  const { data: options, error: optErr } = await supabase.functions.invoke(
    "passkey-register-options",
    { body: {} },
  );
  if (optErr) throw optErr;

  // 2. Converter campos base64url → ArrayBuffer
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  // 3. Criar credencial no autenticador
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
  if (!cred) throw new Error("Não foi possível criar a passkey");

  const attResp = cred.response as AuthenticatorAttestationResponse;
  const credentialJSON = {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(attResp.clientDataJSON),
      attestationObject: bufferToBase64url(attResp.attestationObject),
      transports: typeof attResp.getTransports === "function" ? attResp.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };

  // 4. Verificar no backend
  const { error: verifyErr } = await supabase.functions.invoke("passkey-register-verify", {
    body: { credential: credentialJSON, deviceName },
  });
  if (verifyErr) throw verifyErr;
}

// ============ Autenticação ============
export async function authenticateWithPasskey(email?: string): Promise<void> {
  // 1. Pedir options
  const { data: options, error: optErr } = await supabase.functions.invoke(
    "passkey-auth-options",
    { body: { email } },
  );
  if (optErr) throw optErr;

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  // 2. Solicitar assertion
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
  if (!cred) throw new Error("Falha na autenticação");

  const assResp = cred.response as AuthenticatorAssertionResponse;
  const credentialJSON = {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(assResp.clientDataJSON),
      authenticatorData: bufferToBase64url(assResp.authenticatorData),
      signature: bufferToBase64url(assResp.signature),
      userHandle: assResp.userHandle ? bufferToBase64url(assResp.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };

  // 3. Verificar e obter token_hash
  const { data, error: verifyErr } = await supabase.functions.invoke("passkey-auth-verify", {
    body: { credential: credentialJSON, email },
  });
  if (verifyErr) throw verifyErr;
  if (!data?.token_hash) throw new Error("Token não retornado");

  // 4. Criar sessão Supabase
  const { error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.token_hash,
  });
  if (otpErr) throw otpErr;
}

// ============ Listagem / remoção ============
export async function listPasskeys() {
  const { data, error } = await supabase
    .from("user_passkeys")
    .select("id, device_name, created_at, last_used_at, backed_up")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deletePasskey(id: string) {
  const { error } = await supabase.from("user_passkeys").delete().eq("id", id);
  if (error) throw error;
}
