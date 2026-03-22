import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProviderStatRow {
  provider_key: string;
  display_name: string;
  is_free: boolean;
  rate_limit_rpd: number | null;
  consecutive_errors: number;
  is_active: boolean;
  avg_latency_ms: number;
  requests_today: number;
  success_rate: number;
  quality_score: number | null;
  score: number;
  total_requests: number;
  rate_limit_hits: number;
}

function calculateScore(
  isFree: boolean,
  avgLatency: number,
  successRate: number,
  qualityScore: number | null,
  rpd: number,
  usedToday: number,
  consecutiveErrors: number,
): number {
  let score = 0;
  score += isFree ? 40 : 8;

  if (avgLatency < 500) score += 25;
  else if (avgLatency < 1000) score += 20;
  else if (avgLatency < 3000) score += 15;
  else if (avgLatency < 10000) score += 10;
  else score += 5;

  if (successRate > 99) score += 25;
  else if (successRate > 95) score += 20;
  else if (successRate > 90) score += 15;
  else if (successRate > 80) score += 10;
  else score += 0;

  const qs = qualityScore || 3.5;
  if (qs > 4.0) score += 10;
  else if (qs > 3.0) score += 7;
  else score += 3;

  if (usedToday >= rpd) return -1;
  if (usedToday > rpd * 0.8) score -= 15;
  if (consecutiveErrors > 0) score -= Math.min(consecutiveErrors * 5, 30);

  return Math.max(score, 0);
}

export function useAiRouterProviderStats() {
  return useQuery({
    queryKey: ["ai-router-provider-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      const [providersRes, statsRes] = await Promise.all([
        (supabase as any).from("ai_router_providers_safe").select("provider_key, display_name, is_free, rate_limit_rpd, consecutive_errors, is_active"),
        (supabase as any).from("ai_router_provider_stats").select("provider_key, task_type, total_requests, successful_requests, failed_requests, avg_latency_ms, requests_today, rate_limit_hits, quality_score").eq("period_date", today).is("task_type", null),
      ]);

      const providers = (providersRes.data || []) as any[];
      const stats = (statsRes.data || []) as any[];
      const statsMap = new Map<string, any>();
      for (const s of stats) {
        statsMap.set(s.provider_key, s);
      }

      const result: ProviderStatRow[] = providers
        .filter((p: any) => p.is_active)
        .map((p: any) => {
          const s = statsMap.get(p.provider_key);
          const totalReqs = s?.total_requests || 0;
          const successRate = totalReqs > 0
            ? Math.round((s.successful_requests / totalReqs) * 1000) / 10
            : 100;
          const avgLatency = s?.avg_latency_ms || 0;
          const rpd = p.rate_limit_rpd || 10000;
          const usedToday = s?.requests_today || 0;
          const score = calculateScore(p.is_free, avgLatency, successRate, s?.quality_score, rpd, usedToday, p.consecutive_errors || 0);

          return {
            provider_key: p.provider_key,
            display_name: p.display_name,
            is_free: p.is_free,
            rate_limit_rpd: p.rate_limit_rpd,
            consecutive_errors: p.consecutive_errors || 0,
            is_active: p.is_active,
            avg_latency_ms: avgLatency,
            requests_today: usedToday,
            success_rate: successRate,
            quality_score: s?.quality_score || null,
            score,
            total_requests: totalReqs,
            rate_limit_hits: s?.rate_limit_hits || 0,
          };
        })
        .sort((a: ProviderStatRow, b: ProviderStatRow) => b.score - a.score);

      return result;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}
