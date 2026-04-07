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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch the original image and convert to base64
    const imgRes = await fetch(image_url);
    if (!imgRes.ok) throw new Error("Failed to fetch image");
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    const mimeType = imgRes.headers.get("content-type") || "image/png";
    const dataUrl = `data:${mimeType};base64,${imgBase64}`;

    // Use Lovable AI Gateway to edit the image - remove background
    const aiRes = await fetch("https://ai.lovable.dev/api/edit-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        image: dataUrl,
        prompt: "Remove the background completely, making it fully transparent. Keep only the main subject/logo with clean edges. Output a PNG with transparent background.",
        aspect_ratio: "1:1",
      }),
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, errorText);
      throw new Error(`AI Gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();

    // The AI gateway returns the edited image - extract base64
    let resultBase64 = "";
    if (aiData.image) {
      // If it returns a data URL, strip the prefix
      resultBase64 = aiData.image.replace(/^data:image\/\w+;base64,/, "");
    } else if (aiData.url) {
      // If it returns a URL, fetch and convert
      const resultRes = await fetch(aiData.url);
      const resultBuffer = await resultRes.arrayBuffer();
      resultBase64 = btoa(String.fromCharCode(...new Uint8Array(resultBuffer)));
    } else {
      throw new Error("Unexpected AI response format");
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
