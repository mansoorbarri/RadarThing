export type FreeAllowanceFeature = "charts";

// Distinct items a FREE user can open per UTC day. PRO is unlimited.
export const FREE_DAILY_ALLOWANCE: Record<FreeAllowanceFeature, number> = {
  charts: 3,
};

export interface FreeAllowanceResult {
  allowed: boolean;
  used: number;
  limit: number;
}

// Re-opening something already counted today is always allowed.
export function applyFreeAllowance(
  keys: readonly string[],
  key: string,
  limit: number,
): FreeAllowanceResult & { keys: string[] } {
  if (keys.includes(key)) {
    return { allowed: true, used: keys.length, limit, keys: [...keys] };
  }
  if (keys.length >= limit) {
    return { allowed: false, used: keys.length, limit, keys: [...keys] };
  }
  const next = [...keys, key];
  return { allowed: true, used: next.length, limit, keys: next };
}
