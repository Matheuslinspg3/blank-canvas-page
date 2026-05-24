import { differenceInDays } from 'date-fns';

export const STALE_DAYS = 7;
export const CRITICAL_DAYS = 14;

export function getLeadStalenessDays(updatedAt: string | Date): number {
  return differenceInDays(new Date(), new Date(updatedAt));
}

export function isLeadStale(updatedAt: string | Date): boolean {
  return getLeadStalenessDays(updatedAt) >= STALE_DAYS;
}

export function isLeadCritical(updatedAt: string | Date): boolean {
  return getLeadStalenessDays(updatedAt) >= CRITICAL_DAYS;
}
