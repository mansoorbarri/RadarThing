/**
 * Strip Convex's error wrapper so we can match the original
 * message thrown by the mutation (e.g. "[CONVEX M(...)] Uncaught Error: Pilot not found" → "Pilot not found").
 */
function normalizeConvexError(message: string): string {
  const idx = message.indexOf("Uncaught Error:");
  if (idx === -1) return message.trim();
  return message.slice(idx + "Uncaught Error:".length).trim();
}

/**
 * Map backend error messages from api.virtualAirlineMembers.add to
 * client-safe, human-readable strings. Unmapped errors receive a
 * generic fallback that never exposes raw backend details.
 */
export function mapVirtualAirlineMemberAddError(message: string): string {
  const normalized = normalizeConvexError(message);
  switch (normalized) {
    case "Pilot is already assigned to another VA":
      return "That pilot is already assigned to another VA";
    case "Pilot not found":
      return "Pilot not found — the user may have deleted their account";
    case "Pilots must connect Discord to RadarThing before joining a VA":
      return "This pilot must connect their Discord account before joining a VA";
    default:
      return "Failed to add pilot to VA";
   }
}
