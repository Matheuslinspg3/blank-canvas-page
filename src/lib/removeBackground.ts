import { supabase } from "@/integrations/supabase/client";

/**
 * Remove background from an image via edge function (Gemini).
 * Returns a PNG Blob with transparent background.
 */
export async function removeBackground(imageUrl: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("remove-bg", {
    body: { image_url: imageUrl },
  });

  if (error) throw error;
  if (data?.error) {
    if (data.error.includes("quota")) {
      throw new Error("Limite de uso da IA atingido. Tente novamente mais tarde.");
    }
    throw new Error(data.error);
  }

  const byteString = atob(data.image_base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  return new Blob([bytes], { type: data.content_type || "image/png" });
}