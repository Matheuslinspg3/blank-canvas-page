/**
 * Cloudinary-based logo background removal using `e_make_transparent` transformation.
 *
 * This uses Cloudinary's native on-the-fly URL transformation — no AI APIs,
 * no extra costs, works within the free tier.
 *
 * @see https://cloudinary.com/documentation/transformation_reference#e_make_transparent
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

export type TransparentBgColor = "white" | "black" | "auto";

export interface LogoTransparencyOptions {
  color?: TransparentBgColor;
  tolerance?: number;
}

function unwrapCloudinaryUrl(url: string): string {
  if (!url) return url;
  if (url.includes("res.cloudinary.com")) return url;

  try {
    const parsed = new URL(url);
    const proxiedUrl = parsed.searchParams.get("url");
    if (proxiedUrl && proxiedUrl.includes("res.cloudinary.com")) {
      return proxiedUrl;
    }
  } catch {
    return url;
  }

  return url;
}

export function isCloudinaryUrl(url: string): boolean {
  return unwrapCloudinaryUrl(url).includes("res.cloudinary.com");
}

export function getLogoPreviewUrl(url: string): string {
  const cloudinaryUrl = unwrapCloudinaryUrl(url);

  if (!cloudinaryUrl || !cloudinaryUrl.includes("res.cloudinary.com") || !SUPABASE_URL) {
    return cloudinaryUrl;
  }

  return `${SUPABASE_URL}/functions/v1/cloudinary-image-proxy?url=${encodeURIComponent(cloudinaryUrl)}`;
}

export function getTransparentLogoUrl(
  cloudinaryUrl: string,
  options: LogoTransparencyOptions = {},
): string {
  const normalizedUrl = unwrapCloudinaryUrl(cloudinaryUrl);
  const { color = "auto", tolerance = 30 } = options;

  if (!normalizedUrl.includes("res.cloudinary.com")) {
    return cloudinaryUrl;
  }

  const toleranceClamped = Math.max(0, Math.min(100, tolerance));
  const transform = color === "auto"
    ? `e_make_transparent:${toleranceClamped}`
    : `e_make_transparent:${toleranceClamped},co_${color}`;

  const transformChain = `${transform}/f_png`;

  if (/\/upload\//.test(normalizedUrl)) {
    return normalizedUrl.replace(/\/upload\//, `/upload/${transformChain}/`);
  }

  return normalizedUrl;
}

export function getTransparentLogoPreviewUrl(
  cloudinaryUrl: string,
  options: LogoTransparencyOptions = {},
): string {
  if (!isCloudinaryUrl(cloudinaryUrl)) return cloudinaryUrl;

  const baseUrl = getTransparentLogoUrl(cloudinaryUrl, options).replace(
    "/f_png/",
    "/f_png,q_60,w_400/",
  );

  return getLogoPreviewUrl(baseUrl);
}
