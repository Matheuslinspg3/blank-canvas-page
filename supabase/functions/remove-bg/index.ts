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

    const apiKey = Deno.env.get("GOOGLE_AI_KEY_1");
    if (!apiKey) throw new Error("GOOGLE_AI_KEY_1 not configured");

    // Fetch image and convert to base64
    const imgRes = await fetch(image_url);
    if (!imgRes.ok) throw new Error("Failed to fetch image");
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    const imgBase64 = btoa(String.fromCharCode(...imgBytes));
    const mimeType = imgRes.headers.get("content-type") || "image/png";

    // Call Gemini with image editing
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imgBase64,
                  },
                },
                {
                  text: "Remove the background from this image completely. Make the background fully transparent. Keep only the main subject/logo with clean, precise edges. Return only the resulting PNG image with transparent background.",
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            imageMimeType: "image/png",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, errText);
      throw new Error(`Gemini error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();

    // Extract image from response
    const candidates = geminiData.candidates || [];
    let resultBase64 = "";

    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          resultBase64 = part.inlineData.data;
          break;
        }
      }
      if (resultBase64) break;
    }

    if (!resultBase64) {
      console.error("Gemini response:", JSON.stringify(geminiData).slice(0, 500));
      throw new Error("No image returned from Gemini");
    }

    return new Response(
      JSON.stringify({ image_base64: resultBase64, content_type: "image/png" }),
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
