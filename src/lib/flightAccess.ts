// Free pilots may only start flights while an admin has marked an event live.
// Pro access (paid, trial, admin grant or admin) can always start one. Ending,
// updating and resuming a flight are never gated.

// With no stored setting the event is treated as live, so deploying this gate
// changes nothing until an admin turns the event off.
export const DEFAULT_EVENT_LIVE = true;

export type FlightStartAccessReason = "pro" | "event_live" | "no_event";

export interface FlightStartAccess {
  allowed: boolean;
  reason: FlightStartAccessReason;
  eventLive: boolean;
}

export function getFlightStartAccess(
  eventLive: boolean,
  hasPro: boolean,
): FlightStartAccess {
  if (hasPro) return { allowed: true, reason: "pro", eventLive };
  if (eventLive) return { allowed: true, reason: "event_live", eventLive };
  return { allowed: false, reason: "no_event", eventLive };
}

export const NO_EVENT_FLIGHT_MESSAGE =
  "No event is live right now, and starting a flight outside an event needs RadarThing Pro.";
