export const FLIGHT_HISTORY_PAGE_SIZE = 10;
export const FREE_RECENT_FLIGHTS_LIMIT = FLIGHT_HISTORY_PAGE_SIZE;

export interface FlightHistorySearchable {
  callsign: string;
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  maxAltitude?: number;
  maxSpeed?: number;
  routeData?: [number, number][];
}

export function normalizeFlightSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatSearchDateVariants(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return [
    `${year}-${month}-${day}`,
    `${month}/${day}/${year}`,
    `${day}/${month}/${year}`,
    `${year}${month}${day}`,
    `${hours}:${minutes}`,
    `${hours}${minutes}`,
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }),
  ];
}

function formatSearchDuration(
  startTime: number,
  endTime?: number,
  duration?: number,
) {
  if (!endTime && duration === undefined)
    return ["in progress", "active", "ongoing"];

  const durationMs =
    typeof duration === "number" && Number.isFinite(duration)
      ? duration
      : endTime !== undefined
        ? endTime - startTime
        : 0;
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return [
    `${totalMinutes}m`,
    `${totalMinutes} min`,
    `${hours}h ${minutes}m`,
    `${hours}h${minutes}m`,
    `${hours}:${String(minutes).padStart(2, "0")}`,
    "completed",
  ];
}

export function buildFlightSearchCandidates(flight: FlightHistorySearchable) {
  const rawValues = [
    flight.callsign,
    flight.aircraftType,
    flight.depICAO,
    flight.arrICAO,
    flight.depICAO && flight.arrICAO
      ? `${flight.depICAO}-${flight.arrICAO}`
      : undefined,
    flight.depICAO && flight.arrICAO
      ? `${flight.depICAO} ${flight.arrICAO}`
      : undefined,
    ...formatSearchDateVariants(flight.startTime),
    ...formatSearchDuration(flight.startTime, flight.endTime, flight.duration),
    typeof flight.maxAltitude === "number"
      ? `${Math.round(flight.maxAltitude)}`
      : undefined,
    typeof flight.maxSpeed === "number"
      ? `${Math.round(flight.maxSpeed)}`
      : undefined,
    flight.routeData && flight.routeData.length > 1
      ? "replayable"
      : "no replay",
    flight.endTime ? undefined : "in progress",
  ].filter(Boolean);

  const normalizedCandidates = new Set<string>();
  for (const value of rawValues) {
    const normalized = normalizeFlightSearch(String(value));
    if (!normalized) continue;

    normalizedCandidates.add(normalized);
    for (const part of normalized.split(" ")) {
      if (part) normalizedCandidates.add(part);
    }
  }

  return [...normalizedCandidates];
}

export function isSubsequenceMatch(needle: string, haystack: string) {
  if (!needle) return true;

  let needleIndex = 0;
  for (const character of haystack) {
    if (character === needle[needleIndex]) {
      needleIndex += 1;
      if (needleIndex === needle.length) return true;
    }
  }

  return false;
}

export function matchesFlightHistorySearch(
  flight: FlightHistorySearchable,
  searchQuery: string,
) {
  if (!searchQuery) return true;

  const tokens = normalizeFlightSearch(searchQuery).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const candidates = buildFlightSearchCandidates(flight);
  return tokens.every((token) =>
    candidates.some(
      (candidate) =>
        candidate.includes(token) || isSubsequenceMatch(token, candidate),
    ),
  );
}
