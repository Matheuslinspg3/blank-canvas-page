import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a logo file to Cloudinary using signed upload via the cloudinary-sign Edge Function.
 * Returns the Cloudinary secure_url on success.
 */
export async function uploadLogoToCloudinary(
  file: File,
  organizationId: string,
  field: string
): Promise<string> {
  const folder = `${organizationId}/brand`;

  // Get signed upload params from Edge Function
  const { data: signature, error: signError } = await supabase.functions.invoke("cloudinary-sign", {
    body: { folder },
  });

  if (signError || !signature) {
    throw new Error("Erro ao obter assinatura de upload");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.api_key);
  formData.append("timestamp", signature.timestamp.toString());
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);
  formData.append("overwrite", "true");
  formData.append("unique_filename", "true");
  if (signature.transformation) {
    formData.append("transformation", signature.transformation);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Upload falhou: ${response.status}`);
  }

  const result = await response.json();
  return result.secure_url;
}
