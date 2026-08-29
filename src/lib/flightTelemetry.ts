/**
 * Backwards-compatible persisted route sample.
 *
 * Legacy flights contain only [lat, lon]. New flight-session writers can append
 * telemetry without breaking distance calculations or existing map consumers.
 */
export type FlightRoutePoint = [
  latitude: number,
  longitude: number,
  altitudeMSL?: number,
  speed?: number,
  heading?: number,
  verticalSpeed?: number,
  timestamp?: number,
];
