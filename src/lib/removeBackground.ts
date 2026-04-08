import { getTransparentLogoUrl, type LogoTransparencyOptions } from "@/lib/cloudinary/logoTransparency";

/**
 * Remove background from an image.
 * 
 * For Cloudinary URLs: uses native `e_make_transparent` transformation (free, instant).
 * For other URLs: fetches the transparent version from Cloudinary URL transformation.
 * 
 * Returns the URL of the image with transparent background.
 */
export function removeBackgroundUrl(
  imageUrl: string,
  options?: LogoTransparencyOptions
): string {
  return getTransparentLogoUrl(imageUrl, options);
}

/**
 * Legacy function kept for backward compatibility.
 * Now uses Cloudinary URL transformation instead of Edge Function.
 * Returns a Blob of the transparent image.
 */
export async function removeBackground(imageUrl: string): Promise<Blob> {
  // For Cloudinary images, fetch the transformed URL
  if (imageUrl.includes("res.cloudinary.com")) {
    const transparentUrl = getTransparentLogoUrl(imageUrl);
    const response = await fetch(transparentUrl);
    if (!response.ok) {
      throw new Error(`Erro ao processar imagem: ${response.status}`);
    }
    return await response.blob();
  }

  // For non-Cloudinary images, we can't use this approach
  throw new Error(
    "A remoção de fundo automática funciona apenas com imagens hospedadas no Cloudinary. " +
    "Faça upload da imagem primeiro."
  );
}
