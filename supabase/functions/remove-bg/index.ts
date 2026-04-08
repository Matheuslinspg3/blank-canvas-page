import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGeminiImageEdit } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { image_url } = await req.json();
    if (!image_url || typeof image_url !== "string") throw new Error("image_url is required");

    const { imageDataUrl } = await callGeminiImageEdit({
      imageUrl: image_url,
      prompt:
        "Remove the background from this image completely. Make the background fully transparent. Keep only the main subject/logo with clean, precise edges. Return only the resulting PNG image with transparent background.",
    });

    const match = imageDataUrl.match(/^data:(.*?);base64,(.*)$/);
    const contentType = match?.[1] || "image/png";
    const resultBase64 = (match?.[2] || "").replace(/\s/g, "");

    if (!resultBase64) throw new Error("No image returned from Gemini");

    return new Response(
      JSON.stringify({ image_base64: resultBase64, content_type: contentType }),
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
