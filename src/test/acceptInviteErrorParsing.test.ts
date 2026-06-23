import { describe, it, expect } from "vitest";

/**
 * Reproduz o parser de erro do `handleSignup` em `AcceptInvite.tsx`:
 * a supabase-js NÃO desserializa o body em respostas não-2xx — o body fica
 * disponível em `error.context` (Response). Precisamos extraí-lo para
 * detectar `email_already_registered` e demais códigos.
 */
async function extractFnError(fnError: any, data: any): Promise<string | null> {
  if (fnError) {
    const ctxResp: Response | undefined = fnError?.context;
    if (ctxResp && typeof ctxResp.json === "function") {
      try {
        const body = await ctxResp.clone().json();
        return body?.error || fnError.message;
      } catch {
        return fnError.message;
      }
    }
    return fnError.message;
  }
  if (data?.error) return data.error as string;
  return null;
}

function mkError(status: number, body: any) {
  const resp = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  return { message: `Edge Function returned a non-2xx status code`, context: resp };
}

describe("AcceptInvite error parsing", () => {
  it("returns null on success", async () => {
    expect(await extractFnError(null, { success: true })).toBeNull();
  });

  it("extracts email_already_registered from a 409 FunctionsHttpError", async () => {
    const err = mkError(409, { error: "email_already_registered" });
    expect(await extractFnError(err, null)).toBe("email_already_registered");
  });

  it("extracts the friendly error from a 400", async () => {
    const err = mkError(400, { error: "Código da imobiliária incorreto" });
    expect(await extractFnError(err, null)).toBe("Código da imobiliária incorreto");
  });

  it("falls back to data.error when fnError is absent", async () => {
    expect(await extractFnError(null, { error: "boom" })).toBe("boom");
  });

  it("falls back to fnError.message when body has no error field", async () => {
    const err = mkError(500, { foo: "bar" });
    expect(await extractFnError(err, null)).toMatch(/non-2xx/);
  });
});
