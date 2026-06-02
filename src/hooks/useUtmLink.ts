import { useSearchParams } from "react-router-dom";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];

/**
 * Returns a path with UTM params from the current URL appended.
 * Useful for internal navigation links that should preserve campaign attribution.
 *
 * Example: buildUtmLink("/auth?tab=cadastro") → "/auth?tab=cadastro&utm_source=meta&..."
 */
export function useUtmLink() {
  const [searchParams] = useSearchParams();

  return (basePath: string): string => {
    const url = new URL(basePath, "http://localhost");
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value && !url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
    return url.pathname + url.search;
  };
}
