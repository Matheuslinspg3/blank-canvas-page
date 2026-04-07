import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { image_url } = await req.json();
    if (!image_url) throw new Error("image_url is required");

    // Fetch the image
    const imgRes = await fetch(image_url);
    if (!imgRes.ok) throw new Error("Failed to fetch image");
    const imgBlob = await imgRes.blob();

    // Use remove.bg API
    const apiKey = Deno.env.get("REMOVE_BG_API_KEY");
    if (!apiKey) throw new Error("REMOVE_BG_API_KEY not configured");

    const formData = new FormData();
    formData.append("image_file", imgBlob, "logo.png");
    formData.append("size", "auto");

    const bgRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!bgRes.ok) {
      const errorText = await bgRes.text();
      throw new Error(`remove.bg error: ${bgRes.status} - ${errorText}`);
    }

    const resultBlob = await bgRes.blob();
    const arrayBuffer = await resultBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    return new Response(
      JSON.stringify({ image_base64: base64, content_type: "image/png" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
