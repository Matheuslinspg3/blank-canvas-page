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

    const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary credentials not configured");
    }

    // Upload to Cloudinary with background_removal effect
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramsToSign = `background_removal=cloudinary_ai&folder=remove-bg&timestamp=${timestamp}`;

    // Generate SHA-1 signature
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign + apiSecret);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const formData = new FormData();
    formData.append("file", image_url);
    formData.append("background_removal", "cloudinary_ai");
    formData.append("folder", "remove-bg");
    formData.append("timestamp", timestamp);
    formData.append("api_key", apiKey);
    formData.append("signature", signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("Cloudinary upload error:", errText);
      throw new Error(`Cloudinary error: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    const processedUrl = uploadData.secure_url;

    // Fetch the processed image and convert to base64
    const imgRes = await fetch(processedUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));

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
