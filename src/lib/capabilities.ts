export type UserRole = "FREE" | "PRO";

// Check if user has PRO features
export function hasPRO(role?: UserRole | null) {
  return role === "PRO";
}

// Check if user is admin (by comparing googleId with env variable)
export function isADMIN(
  googleId?: string | null,
  adminGoogleId?: string | null,
) {
  if (!googleId || !adminGoogleId) return false;
  return googleId === adminGoogleId;
}
