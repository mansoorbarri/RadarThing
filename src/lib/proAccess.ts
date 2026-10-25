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

// No-card trial granted from the pricing page, once per account.
export const FREE_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Stripe Checkout rejects a trial_end less than 48 hours away, so subscribing
// closer to the end of the no-card trial starts billing immediately.
export const MIN_STRIPE_TRIAL_MS = 49 * 60 * 60 * 1000;

export type TempProDurationValue =
  (typeof TEMP_PRO_DURATION_OPTIONS)[number]["value"];

export interface ProAccessUserLike {
  role?: ProAccessRole | null;
  activeBanId?: string | null;
  isDeleted?: boolean;
  adminProExpiresAt?: number | null;
  trialStartedAt?: number | null;
  trialEndsAt?: number | null;
  stripeSubscriptionId?: string | null;
}

export function hasActiveAdminProGrant(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
) {
  return Boolean(
    typeof user?.adminProExpiresAt === "number" && user.adminProExpiresAt > now,
  );
}

export function hasActiveTrial(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
) {
  return Boolean(
    typeof user?.trialEndsAt === "number" && user.trialEndsAt > now,
  );
}

// A user gets one trial: either the no-card trial or a Stripe checkout trial.
export function hasUsedTrial(user: ProAccessUserLike | null | undefined) {
  return Boolean(
    typeof user?.trialStartedAt === "number" || user?.stripeSubscriptionId,
  );
}

export function canStartFreeTrial(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
) {
  if (!user || user.activeBanId || user.isDeleted) return false;
  if (user.role === "ADMIN" || user.role === "PRO") return false;
  if (hasActiveAdminProGrant(user, now)) return false;
  return !hasUsedTrial(user);
}

export function hasEffectiveProAccess(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
) {
  if (!user || user.activeBanId || user.isDeleted) return false;
  return (
    user.role === "ADMIN" ||
    user.role === "PRO" ||
    hasActiveAdminProGrant(user, now) ||
    hasActiveTrial(user, now)
  );
}

export function getEffectiveAccessRole(
  user: ProAccessUserLike | null | undefined,
  now = Date.now(),
): ProAccessRole {
  if (!user || user.activeBanId || user.isDeleted) return "FREE";
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
