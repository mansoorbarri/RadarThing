const FLIGHT_MODERATOR_GOOGLE_IDS = new Set(["101233162035372298523"]);

export function isFlightModeratorGoogleId(
  googleId: string | null | undefined,
): boolean {
  if (!googleId) return false;
  return FLIGHT_MODERATOR_GOOGLE_IDS.has(googleId);
}
