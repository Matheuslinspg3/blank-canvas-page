import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_KEY_PREFIXES = ["imoveis/", "properties/"];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getObjectKey(reqUrl: URL, endpoint: string, bucket: string): string | null {
  const key = reqUrl.searchParams.get("key")?.trim();
  if (key) return key.replace(/^\/+/, "");

  const rawUrl = reqUrl.searchParams.get("url")?.trim();
  if (!rawUrl) return null;

  const parsed = new URL(rawUrl);
  const endpointHost = new URL(endpoint).host;
  if (parsed.host !== endpointHost) return null;

  const path = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const bucketPrefix = `${bucket}/`;
  if (!path.startsWith(bucketPrefix)) return null;

  return path.slice(bucketPrefix.length);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") return jsonError("Method not allowed", 405);

  try {
    const accessKey = (Deno.env.get("R2_ACCESS_KEY_ID") ?? "").trim();
    const secretKey = (Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "").trim();
    const endpoint = (Deno.env.get("R2_ENDPOINT") ?? "").trim().replace(/\/$/, "");
    const bucket = (Deno.env.get("R2_BUCKET_NAME") ?? "").trim();

    if (!accessKey || !secretKey || !endpoint || !bucket) {
      return jsonError("R2 config incompleta", 500);
    }

    const reqUrl = new URL(req.url);
    const objectKey = getObjectKey(reqUrl, endpoint, bucket);
    if (!objectKey || objectKey.includes("..") || objectKey.includes("\\0")) {
      return jsonError("Imagem inválida", 400);
    }

    if (!ALLOWED_KEY_PREFIXES.some((prefix) => objectKey.startsWith(prefix))) {
      return jsonError("Caminho de imagem não permitido", 403);
    }

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region: "auto",
      service: "s3",
    });

    const objectUrl = `${endpoint}/${bucket}/${objectKey}`;
    const upstream = await aws.fetch(objectUrl, {
      method: req.method,
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
    });

    if (!upstream.ok) {
      console.error(`[r2-image-proxy] R2 GET failed: ${upstream.status} ${objectKey}`);
      return jsonError("Imagem não encontrada", upstream.status === 404 ? 404 : 502);
    }

    const contentType = upstream.headers.get("content-type") || "image/webp";
    if (!contentType.startsWith("image/") && contentType !== "application/octet-stream") {
      return jsonError("Arquivo não é imagem", 415);
    }

    return new Response(req.method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType.startsWith("image/") ? contentType : "image/webp",
        "Cache-Control": "public, max-age=604800, s-maxage=2592000",
        "X-Source": "r2-image-proxy",
      },
    });
  } catch (error) {
    console.error("[r2-image-proxy] error:", error);
    return jsonError("Erro interno", 500);
  }
});