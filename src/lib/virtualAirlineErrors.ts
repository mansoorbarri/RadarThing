/**
 * Map backend error messages from api.virtualAirlineMembers.add to
 * client-safe, human-readable strings. Unmapped errors receive a
 * generic fallback that never exposes raw backend details.
 */
export function mapVirtualAirlineMemberAddError(message: string): string {
  switch (message) {
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
