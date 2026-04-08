import { removeBackground as imglyRemoveBg } from "@imgly/background-removal";

/**
 * Remove background from an image blob entirely in the browser (no API needed).
 * Returns a PNG Blob with transparent background.
 */
export async function removeBackground(imageUrl: string): Promise<Blob> {
  // Fetch the image as a blob first
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Não foi possível carregar a imagem");
  const inputBlob = await response.blob();

  const resultBlob = await imglyRemoveBg(inputBlob, {
    output: { format: "image/png", quality: 0.9 },
  });

  return resultBlob;
}