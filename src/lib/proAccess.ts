export type ProAccessRole = "FREE" | "PRO" | "ADMIN";

export const TEMP_PRO_DURATION_OPTIONS = [
  {
    value: "1d",
    label: "1 day",
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    value: "1w",
    label: "1 week",
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    value: "1m",
    label: "1 month",
    durationMs: 30 * 24 * 60 * 60 * 1000,
  },
] as const;

export type TempProDurationValue =
  (typeof TEMP_PRO_DURATION_OPTIONS)[number]["value"];

export interface ProAccessUserLike {
  role?: ProAccessRole | null;
  adminProExpiresAt?: number | null;
}

export function hasActiveAdminProGrant(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
) {
  return Boolean(
    typeof user?.adminProExpiresAt === "number" && user.adminProExpiresAt > now,
  );
}

export function hasEffectiveProAccess(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
) {
  if (!user) return false;
  return (
    user.role === "ADMIN" ||
    user.role === "PRO" ||
    hasActiveAdminProGrant(user, now)
  );
}

export function getEffectiveAccessRole(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
): ProAccessRole {
  if (!user) return "FREE";
  if (user.role === "ADMIN") return "ADMIN";
  if (hasEffectiveProAccess(user, now)) return "PRO";
  return "FREE";
}

export function getTempProExpirationFromValue(
  value: TempProDurationValue,
  now = Date.now(),
) {
  const option = TEMP_PRO_DURATION_OPTIONS.find((item) => item.value === value);
  if (!option) {
    throw new Error(`Unsupported temporary PRO duration: ${value}`);
  }

  return now + option.durationMs;
}
