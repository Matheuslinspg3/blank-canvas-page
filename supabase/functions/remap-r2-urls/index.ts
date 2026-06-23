// Remaps any DB URL pointing to the private R2 endpoint to the configured R2_PUBLIC_URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const endpoint = Deno.env.get("R2_ENDPOINT") || "";
    const bucket = Deno.env.get("R2_BUCKET_NAME") || "";
    const publicUrl = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/$/, "");

    if (!publicUrl || publicUrl.includes("r2.cloudflarestorage.com")) {
      return new Response(
        JSON.stringify({ error: "R2_PUBLIC_URL inválido ou ainda apontando para endpoint privado", publicUrl }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Old private prefix patterns to strip
    const privatePrefixes = [
      `${endpoint.replace(/\/$/, "")}/${bucket}/`,
      `https://${new URL(endpoint).host}/${bucket}/`,
    ];

    const summary: Record<string, number> = {};

    async function remapTable(table: string, urlCols: string[]) {
      let total = 0;
      for (const col of urlCols) {
        for (const prefix of privatePrefixes) {
          const { data, error } = await supabase
            .from(table)
            .select(`id, ${col}`)
            .ilike(col, `${prefix}%`)
            .limit(5000);
          if (error) { console.error(`[remap] ${table}.${col}:`, error.message); continue; }
          for (const row of data || []) {
            const oldUrl: string = (row as any)[col];
            if (!oldUrl) continue;
            const key = oldUrl.substring(prefix.length);
            const newUrl = `${publicUrl}/${key}`;
            const { error: upErr } = await supabase
              .from(table)
              .update({ [col]: newUrl })
              .eq("id", (row as any).id);
            if (!upErr) total += 1;
          }
        }
      }
      summary[table] = total;
    }

    await remapTable("properties", ["cover_image_url"]);
    await remapTable("property_images", ["url", "cached_thumbnail_url"]);

    return new Response(JSON.stringify({ ok: true, publicUrl, updated: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
