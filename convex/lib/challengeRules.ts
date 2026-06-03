export type ChallengeRuleType =
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

export type ChallengeRuleScope = "challenge" | "each_flight";

export interface ChallengeRuleConfig {
  ruleType: ChallengeRuleType;
  scope?: ChallengeRuleScope;
  targetAirport?: string;
  targetDepartureAirport?: string;
  targetArrivalAirport?: string;
  targetAircraftType?: string;
  requiredAirportCount?: number;
  requiredFlightCount?: number;
  minDurationMinutes?: number;
  minDistanceNm?: number;
}

export interface ChallengeRule extends ChallengeRuleConfig {
  mode: "auto" | "manual";
  rules?: ChallengeRuleConfig[];
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
  challenge:
    | ChallengeRule
    | (ChallengeRuleConfig & Pick<ChallengeRule, "mode" | "startAt" | "endAt">),
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

export function isAggregateChallengeRule(ruleType: ChallengeRuleType): boolean {
  return (
    ruleType === "visit_airport_count" ||
    ruleType === "flight_count" ||
    ruleType === "min_duration" ||
    ruleType === "min_distance"
  );
}

export function getChallengeRules(challenge: ChallengeRule) {
  return challenge.rules && challenge.rules.length > 0
    ? challenge.rules
    : [
        {
          ruleType: challenge.ruleType,
          scope: challenge.scope,
          targetAirport: challenge.targetAirport,
          targetDepartureAirport: challenge.targetDepartureAirport,
          targetArrivalAirport: challenge.targetArrivalAirport,
          targetAircraftType: challenge.targetAircraftType,
          requiredAirportCount: challenge.requiredAirportCount,
          requiredFlightCount: challenge.requiredFlightCount,
          minDurationMinutes: challenge.minDurationMinutes,
          minDistanceNm: challenge.minDistanceNm,
        },
      ];
}

export function getRuleScope(rule: ChallengeRuleConfig): ChallengeRuleScope {
  return rule.scope ?? "challenge";
}

export function getPerFlightChallengeRules(challenge: ChallengeRule) {
  return getChallengeRules(challenge).filter(
    (rule) => getRuleScope(rule) === "each_flight",
  );
}

export function getChallengeScopedRules(challenge: ChallengeRule) {
  return getChallengeRules(challenge).filter(
    (rule) => getRuleScope(rule) === "challenge",
  );
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

export function sumFlightDurationsMinutes(flights: ChallengeFlight[]) {
  return flights.reduce((total, flight) => {
    if (
      typeof flight.endTime !== "number" ||
      !Number.isFinite(flight.endTime) ||
      flight.endTime <= flight.startTime
    ) {
      return total;
    }

    return total + (flight.endTime - flight.startTime) / 60000;
  }, 0);
}

export function sumFlightDistancesNm(flights: ChallengeFlight[]) {
  return flights.reduce(
    (total, flight) => total + calculateRouteDistanceNm(flight.routeData),
    0,
  );
}

export function doesFlightCollectionMatchChallenge(
  challenge: ChallengeRule,
  flights: ChallengeFlight[],
): boolean {
  const rules = getChallengeRules(challenge);
  const flightsInWindow = getFlightsInChallengeWindow(challenge, flights);
  const perFlightRules = rules.filter(
    (rule) => getRuleScope(rule) === "each_flight",
  );
  const challengeRules = rules.filter(
    (rule) => getRuleScope(rule) === "challenge",
  );
  const eligibleFlights =
    perFlightRules.length > 0
      ? flightsInWindow.filter((flight) =>
          perFlightRules.every((rule) =>
            doesFlightMatchChallenge(
              { ...challenge, ...rule, rules: [rule] },
              flight,
            ),
          ),
        )
      : flightsInWindow;

  if (challengeRules.length > 1) {
    return challengeRules.every((rule) =>
      doesFlightCollectionMatchChallenge(
        {
          ...challenge,
          ...rule,
          rules: [rule],
        },
        eligibleFlights,
      ),
    );
  }

  if (challengeRules.length === 0) {
    return eligibleFlights.length > 0;
  }

  const [rule] = challengeRules;
  if (!rule) return false;
  const ruleChallenge = { ...challenge, ...rule, rules: [rule] };

  switch (rule.ruleType) {
    case "visit_airport_count":
      return (
        typeof rule.requiredAirportCount === "number" &&
        countUniqueVisitedAirports(eligibleFlights) >= rule.requiredAirportCount
      );
    case "flight_count":
      return (
        typeof rule.requiredFlightCount === "number" &&
        eligibleFlights.length >= rule.requiredFlightCount
      );
    case "min_duration":
      return (
        typeof rule.minDurationMinutes === "number" &&
        sumFlightDurationsMinutes(eligibleFlights) >= rule.minDurationMinutes
      );
    case "min_distance":
      return (
        typeof rule.minDistanceNm === "number" &&
        sumFlightDistancesNm(eligibleFlights) >= rule.minDistanceNm
      );
    default:
      return eligibleFlights.some((flight) =>
        doesFlightMatchChallenge(ruleChallenge, flight),
      );
  }
}
