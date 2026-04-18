export interface ChallengeRule {
  mode: "auto" | "manual";
  ruleType:
    | "visit_airport"
    | "visit_airport_count"
    | "depart_airport"
    | "arrive_airport"
    | "route"
    | "aircraft_type"
    | "flight_count"
    | "min_duration"
    | "min_distance"
    | "manual";
  targetAirport?: string;
  targetDepartureAirport?: string;
  targetArrivalAirport?: string;
  targetAircraftType?: string;
  requiredAirportCount?: number;
  requiredFlightCount?: number;
  minDurationMinutes?: number;
  minDistanceNm?: number;
  durationDays?: number;
  startAt: number;
  endAt: number;
  isPublished: boolean;
}

export interface ChallengeFlight {
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
  startTime: number;
  endTime?: number;
  routeData?: unknown;
}

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function isCoordinatePair(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    Number.isFinite(point[0]) &&
    typeof point[1] === "number" &&
    Number.isFinite(point[1])
  );
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const radiusNm = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusNm * c;
}

function toRad(value: number) {
  return value * (Math.PI / 180);
}

export function calculateRouteDistanceNm(routeData: unknown) {
  if (!Array.isArray(routeData)) return 0;

  let totalDistanceNm = 0;
  for (let i = 1; i < routeData.length; i++) {
    const previous = routeData[i - 1];
    const current = routeData[i];
    if (!isCoordinatePair(previous) || !isCoordinatePair(current)) continue;
    totalDistanceNm += haversineDistance(
      previous[0],
      previous[1],
      current[0],
      current[1],
    );
  }

  return totalDistanceNm;
}

export function isChallengeActiveAt(
  challenge: Pick<ChallengeRule, "startAt" | "endAt" | "isPublished">,
  now: number,
) {
  return (
    challenge.isPublished && challenge.startAt <= now && challenge.endAt > now
  );
}

export function doesFlightMatchChallenge(
  challenge: ChallengeRule,
  flight: ChallengeFlight,
) {
  if (challenge.mode !== "auto") return false;
  if (
    flight.startTime < challenge.startAt ||
    flight.startTime >= challenge.endAt
  ) {
    return false;
  }

  const depICAO = normalizeCode(flight.depICAO);
  const arrICAO = normalizeCode(flight.arrICAO);
  const aircraftType = normalizeCode(flight.aircraftType);
  const targetAirport = normalizeCode(challenge.targetAirport);
  const targetDepartureAirport = normalizeCode(
    challenge.targetDepartureAirport,
  );
  const targetArrivalAirport = normalizeCode(challenge.targetArrivalAirport);
  const targetAircraftType = normalizeCode(challenge.targetAircraftType);

  switch (challenge.ruleType) {
    case "visit_airport":
      return (
        Boolean(targetAirport) &&
        (depICAO === targetAirport || arrICAO === targetAirport)
      );
    case "visit_airport_count":
    case "flight_count":
      return false;
    case "depart_airport":
      return Boolean(targetAirport) && depICAO === targetAirport;
    case "arrive_airport":
      return Boolean(targetAirport) && arrICAO === targetAirport;
    case "route":
      return (
        Boolean(targetDepartureAirport) &&
        Boolean(targetArrivalAirport) &&
        depICAO === targetDepartureAirport &&
        arrICAO === targetArrivalAirport
      );
    case "aircraft_type":
      return Boolean(targetAircraftType) && aircraftType === targetAircraftType;
    case "min_duration":
      return (
        typeof challenge.minDurationMinutes === "number" &&
        typeof flight.endTime === "number" &&
        flight.endTime > flight.startTime &&
        flight.endTime - flight.startTime >=
          challenge.minDurationMinutes * 60 * 1000
      );
    case "min_distance":
      return (
        typeof challenge.minDistanceNm === "number" &&
        calculateRouteDistanceNm(flight.routeData) >= challenge.minDistanceNm
      );
    case "manual":
      return false;
  }
}

export function isAggregateChallengeRule(
  ruleType: ChallengeRule["ruleType"],
): boolean {
  return ruleType === "visit_airport_count" || ruleType === "flight_count";
}

export function getFlightsInChallengeWindow<T extends ChallengeFlight>(
  challenge: Pick<ChallengeRule, "startAt" | "endAt">,
  flights: T[],
) {
  return flights.filter(
    (flight) =>
      flight.startTime >= challenge.startAt &&
      flight.startTime < challenge.endAt,
  );
}

export function countUniqueVisitedAirports(flights: ChallengeFlight[]) {
  const visited = new Set<string>();

  for (const flight of flights) {
    const depICAO = normalizeCode(flight.depICAO);
    const arrICAO = normalizeCode(flight.arrICAO);
    if (depICAO) visited.add(depICAO);
    if (arrICAO) visited.add(arrICAO);
  }

  return visited.size;
}

export function doesFlightCollectionMatchChallenge(
  challenge: ChallengeRule,
  flights: ChallengeFlight[],
) {
  const flightsInWindow = getFlightsInChallengeWindow(challenge, flights);

  switch (challenge.ruleType) {
    case "visit_airport_count":
      return (
        typeof challenge.requiredAirportCount === "number" &&
        countUniqueVisitedAirports(flightsInWindow) >=
          challenge.requiredAirportCount
      );
    case "flight_count":
      return (
        typeof challenge.requiredFlightCount === "number" &&
        flightsInWindow.length >= challenge.requiredFlightCount
      );
    default:
      return flightsInWindow.some((flight) =>
        doesFlightMatchChallenge(challenge, flight),
      );
  }
}
