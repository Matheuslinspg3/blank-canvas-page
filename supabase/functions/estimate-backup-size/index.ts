// estimate-backup-size
// Estimativa PRECISA do tamanho do backup de uma organização, reativa por escopo.
// Usado na UI ANTES de ativar, conforme exigência do usuário ("estimativa precisa").
//
// Estratégia:
//   * Fotos: lê os r2_key_full/r2_key_thumb das imagens da org e soma os bytes
//     reais a partir de um mapa key->size obtido via R2 ListObjectsV2 (SigV4),
//     mesmo método já usado por storage-metrics. Bytes reais, não estimativa.
//   * Dados: serializa leads + imóveis (campos principais) e mede o tamanho real
//     do JSON/CSV que seria gravado. Como dados são pequenos, isto é exato.
//
// Admin-only. Retorna breakdown por escopo p/ a UI recalcular ao ligar/desligar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── R2 S3 SigV4 (copiado do padrão storage-metrics) ──
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(data: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}
async function hmac(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const ck = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", ck, new TextEncoder().encode(msg));
}
async function signingKey(secret: string, date: string, region: string, service: string) {
  let k: ArrayBuffer = await hmac(new TextEncoder().encode("AWS4" + secret).buffer, date);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, "aws4_request");
  return k;
}
function sortQueryString(query: string): string {
  if (!query) return "";
  return query.split("&").sort().join("&");
}
async function signedR2Request(
  method: string, path: string, query: string, endpoint: string, accessKey: string, secretKey: string,
): Promise<Response> {
  const host = new URL(endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(new Uint8Array(0));
  const sortedQuery = sortQueryString(query);
  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest =
    `${method}\n${path}\n${sortedQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;
  const sk = await signingKey(secretKey, dateStamp, "auto", "s3");
  const signature = toHex(await hmac(sk, stringToSign));
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = `${endpoint}${path}${sortedQuery ? "?" + sortedQuery : ""}`;
  return fetch(url, {
    method,
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
  });
}

// Mapa completo key -> bytes do bucket (uma passada paginada).
async function buildR2SizeMap(
  endpoint: string, bucket: string, accessKey: string, secretKey: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let continuationToken = "";
  let hasMore = true;
  while (hasMore) {
    let query = "list-type=2&max-keys=1000";
    if (continuationToken) query += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    const res = await signedR2Request("GET", `/${bucket}`, query, endpoint, accessKey, secretKey);
    if (!res.ok) throw new Error(`R2 ListObjects failed: ${res.status} ${await res.text()}`);
    const xml = await res.text();
    // <Contents>...<Key>k</Key>...<Size>n</Size>...</Contents>
    const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m: RegExpExecArray | null;
    while ((m = contentsRegex.exec(xml)) !== null) {
      const block = m[1];
      const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1];
      const size = block.match(/<Size>(\d+)<\/Size>/)?.[1];
      if (key) map.set(key, parseInt(size ?? "0", 10));
    }
    const truncated = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)?.[1] === "true";
    continuationToken = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? "";
    hasMore = truncated && !!continuationToken;
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: orgId } = await userClient.rpc("get_user_organization_id");
    if (!orgId) return json({ error: "no_organization" }, 400);
    const { data: isAdmin } = await admin.rpc("is_org_admin", { _user_id: userId });
    if (!isAdmin) return json({ error: "forbidden_admin_only" }, 403);

    // ── Dados (medição exata via serialização) ──
    const { data: leads } = await admin
      .from("leads").select("*").eq("organization_id", orgId);
    const { data: properties } = await admin
      .from("properties").select("*").eq("organization_id", orgId);

    const leadsBytes = new TextEncoder().encode(JSON.stringify(leads ?? [])).length;
    const propertiesBytes = new TextEncoder().encode(JSON.stringify(properties ?? [])).length;
    const dataBytes = leadsBytes + propertiesBytes;

    // ── Fotos (bytes reais via R2) ──
    const propIds = (properties ?? []).map((p: { id: string }) => p.id);
    let photosOriginalBytes = 0;
    let photosThumbBytes = 0;
    let photosOriginalCount = 0;
    let photosThumbCount = 0;
    let photosNote: string | null = null;

    if (propIds.length > 0) {
      const { data: images } = await admin
        .from("property_images")
        .select("r2_key_full,r2_key_thumb,storage_provider")
        .in("property_id", propIds);

      const fulls = (images ?? []).map((i) => i.r2_key_full).filter(Boolean) as string[];
      const thumbs = (images ?? []).map((i) => i.r2_key_thumb).filter(Boolean) as string[];

      if (fulls.length || thumbs.length) {
        const endpoint = Deno.env.get("R2_ENDPOINT");
        const bucket = Deno.env.get("R2_BUCKET_NAME");
        const ak = Deno.env.get("R2_ACCESS_KEY_ID");
        const sk = Deno.env.get("R2_SECRET_ACCESS_KEY");
        if (endpoint && bucket && ak && sk) {
          const sizeMap = await buildR2SizeMap(endpoint, bucket, ak, sk);
          for (const k of fulls) {
            if (sizeMap.has(k)) { photosOriginalBytes += sizeMap.get(k)!; photosOriginalCount++; }
          }
          for (const k of thumbs) {
            if (sizeMap.has(k)) { photosThumbBytes += sizeMap.get(k)!; photosThumbCount++; }
          }
        } else {
          photosNote = "R2 não configurado; tamanho de fotos indisponível.";
        }
      }
    }

    return json({
      organization_id: orgId,
      counts: {
        leads: (leads ?? []).length,
        properties: (properties ?? []).length,
        photos_original: photosOriginalCount,
        photos_thumbnail: photosThumbCount,
      },
      bytes: {
        data: dataBytes,
        photos_original: photosOriginalBytes,
        photos_thumbnail: photosThumbBytes,
      },
      // Conveniência p/ a UI somar conforme escopo selecionado.
      scopes: {
        data_only: dataBytes,
        data_plus_original: dataBytes + photosOriginalBytes,
        data_plus_thumb: dataBytes + photosThumbBytes,
        data_plus_both: dataBytes + photosOriginalBytes + photosThumbBytes,
      },
      note: photosNote,
    }, 200);
  } catch (err) {
    console.error("estimate-backup-size error:", err);
    return json({ error: "unexpected", message: String(err) }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
