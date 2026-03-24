import { toast } from "@/hooks/use-toast";

const RATE_LIMIT_MESSAGE = "Você atingiu o limite de uso de IA. Aguarde um momento e tente novamente.";

/**
 * Check if an error from supabase.functions.invoke is a 429 rate limit.
 * Shows a toast and returns true if it is.
 */
export function handleAiRateLimitError(error: any): boolean {
  // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
  const status = error?.context?.response?.status ?? error?.status;
  const message = error?.message || "";

  if (status === 429 || message.includes("429") || message.includes("Rate limit") || message.includes("Limite de")) {
    toast({
      title: "Limite de IA atingido",
      description: RATE_LIMIT_MESSAGE,
      variant: "destructive",
    });
    return true;
  }

  // Also check if the data itself contains rate limit error
  return false;
}

/**
 * Check if response data from an edge function is a rate limit error.
 */
export function isRateLimitData(data: any): boolean {
  if (data?.error?.includes?.("Rate limit") || data?.error?.includes?.("Limite de") || data?.message?.includes?.("Limite de")) {
    toast({
      title: "Limite de IA atingido",
      description: RATE_LIMIT_MESSAGE,
      variant: "destructive",
    });
    return true;
  }
  return false;
}
