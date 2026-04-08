/**
 * Cloudinary-based logo background removal using `e_make_transparent` transformation.
 * 
 * This uses Cloudinary's native on-the-fly URL transformation — no AI APIs,
 * no extra costs, works within the free tier.
 * 
 * @see https://cloudinary.com/documentation/transformation_reference#e_make_transparent
 */

export type TransparentBgColor = "white" | "black" | "auto";

export interface LogoTransparencyOptions {
  /** Background color to remove. Default: "auto" */
  color?: TransparentBgColor;
  /** Tolerance for color matching (0-100). Default: 30 */
  tolerance?: number;
}

const COLOR_MAP: Record<TransparentBgColor, string> = {
  white: "e_make_transparent:30/co_white",
  black: "e_make_transparent:30/co_black",
  auto:  "e_make_transparent:30",
};

/**
 * Given a Cloudinary image URL, returns a new URL with background removed.
 * Works by injecting `e_make_transparent` into the Cloudinary URL transformation chain.
 */
export function getTransparentLogoUrl(
  cloudinaryUrl: string,
  options: LogoTransparencyOptions = {}
): string {
  const { color = "auto", tolerance = 30 } = options;

  // Only works with Cloudinary URLs
  if (!cloudinaryUrl.includes("res.cloudinary.com")) {
    return cloudinaryUrl;
  }

  // Build transformation string
  const toleranceClamped = Math.max(0, Math.min(100, tolerance));
  let transform: string;
  if (color === "auto") {
    transform = `e_make_transparent:${toleranceClamped}`;
  } else {
    transform = `e_make_transparent:${toleranceClamped},co_${color}`;
  }

  // Add format conversion to PNG (required for transparency)
  transform += "/f_png";

  // Cloudinary URL pattern: .../upload/[existing_transforms/]v1234/path.ext
  // We inject our transform after "upload/"
  const uploadPattern = /\/upload\//;
  if (uploadPattern.test(cloudinaryUrl)) {
    return cloudinaryUrl.replace(/\/upload\//, `/upload/${transform}/`);
  }

  // If URL doesn't match expected pattern, return as-is
  return cloudinaryUrl;
}

/**
 * Check if a URL is a Cloudinary URL that supports transformations.
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com");
}

/**
 * Preview URL for a logo with transparent background.
 * Uses lower quality for faster preview loading.
 */
export function getTransparentLogoPreviewUrl(
  cloudinaryUrl: string,
  options: LogoTransparencyOptions = {}
): string {
  if (!isCloudinaryUrl(cloudinaryUrl)) return cloudinaryUrl;
  
  const baseUrl = getTransparentLogoUrl(cloudinaryUrl, options);
  // Add quality reduction for preview
  return baseUrl.replace("/f_png/", "/f_png,q_60,w_400/");
}
