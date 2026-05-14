import { type PositionUpdate } from "~/lib/aircraft-store";

const EARTH_RADIUS_NM = 3440.065;
const MIN_PLAUSIBLE_GROUND_SPEED_KTS = 60;
const MAX_PLAUSIBLE_GROUND_SPEED_KTS = 1_200;

export interface LiveFlightPlanWaypoint {
  ident: string;
  type: string;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  spd: string | number | null;
  routePointIndex: number | null;
}

interface RoutePoint {
  waypointIndex: number;
  ident: string;
  type: string;
  lat: number;
  lon: number;
  alt: number | null;
  spd: string | number | null;
}

interface RouteLeg {
  fromRoutePointIndex: number;
  toRoutePointIndex: number;
  fromWaypointIndex: number;
  toWaypointIndex: number;
  distanceNm: number;
  plannedSpeedKts: number;
}

export interface FlightProgressWaypointEta {
  index: number;
  ident: string;
  type: string;
  etaTs: number | null;
  distanceRemainingNm: number | null;
  isActive: boolean;
  isPassed: boolean;
}

export interface FlightProgressSnapshot {
  progressRatio: number;
  progressPercent: number;
  totalDistanceNm: number;
  traveledDistanceNm: number;
  remainingDistanceNm: number;
  elapsedMinutes: number | null;
  remainingMinutes: number | null;
  departureTimeTs: number | null;
  departureTimeSource: "reported" | "estimated" | null;
  arrivalEtaTs: number | null;
  activeWaypointIndex: number;
  currentLegToWaypointIndex: number | null;
  currentGroundSpeedKts: number | null;
  waypointEtas: FlightProgressWaypointEta[];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseSpeedKts(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeWaypointIdent(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function calculateDistanceNm(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

function estimateFallbackSpeedKts(
  from: Pick<RoutePoint, "alt">,
  to: Pick<RoutePoint, "alt">,
) {
  const averageAltitude = ((from.alt ?? 0) + (to.alt ?? 0)) / 2;

  if (averageAltitude >= 32_000) return 460;
  if (averageAltitude >= 18_000) return 380;
  if (averageAltitude >= 10_000) return 300;
  return 220;
}

function projectFractionOnSegment(
  pointLat: number,
  pointLon: number,
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const scale = Math.cos(
    toRadians((pointLat + fromLat + toLat) / 3),
  );
  const px = pointLon * scale;
  const py = pointLat;
  const ax = fromLon * scale;
  const ay = fromLat;
  const bx = toLon * scale;
  const by = toLat;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denominator = abx * abx + aby * aby;

  if (denominator <= 0) {
    return 0;
  }

  return clamp((apx * abx + apy * aby) / denominator, 0, 1);
}

function getProjectedPointOnLeg(
  aircraft: Pick<PositionUpdate, "lat" | "lon">,
  from: RoutePoint,
  to: RoutePoint,
) {
  const fraction = projectFractionOnSegment(
    aircraft.lat,
    aircraft.lon,
    from.lat,
    from.lon,
    to.lat,
    to.lon,
  );
  const projectedLat = from.lat + (to.lat - from.lat) * fraction;
  const projectedLon = from.lon + (to.lon - from.lon) * fraction;

  return {
    fraction,
    offTrackDistanceNm: calculateDistanceNm(
      aircraft.lat,
      aircraft.lon,
      projectedLat,
      projectedLon,
    ),
  };
}

export function parseLiveFlightPlanWaypoints(
  flightPlan?: string,
): LiveFlightPlanWaypoint[] {
  if (!flightPlan) return [];

  try {
    const parsed = JSON.parse(flightPlan) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];

    let routePointIndex = 0;

    return parsed.map((waypoint, index) => {
      const lat = getNullableNumber(waypoint?.lat);
      const lon = getNullableNumber(waypoint?.lon);
      const hasCoords = lat !== null && lon !== null;
      const currentRoutePointIndex = hasCoords ? routePointIndex++ : null;

      return {
        ident: normalizeText(waypoint?.ident, `WP${index + 1}`),
        type: normalizeText(waypoint?.type, "WPT"),
        lat,
        lon,
        alt: getNullableNumber(waypoint?.alt),
        spd:
          typeof waypoint?.spd === "number" || typeof waypoint?.spd === "string"
            ? waypoint.spd
            : null,
        routePointIndex: currentRoutePointIndex,
      };
    });
  } catch {
    return [];
  }
}

function buildRoutePoints(waypoints: LiveFlightPlanWaypoint[]) {
  return waypoints
    .map((waypoint, waypointIndex) => {
      if (waypoint.lat === null || waypoint.lon === null) return null;

      return {
        waypointIndex,
        ident: waypoint.ident,
        type: waypoint.type,
        lat: waypoint.lat,
        lon: waypoint.lon,
        alt: waypoint.alt,
        spd: waypoint.spd,
      } satisfies RoutePoint;
    })
    .filter((waypoint): waypoint is RoutePoint => waypoint !== null);
}

function buildRouteLegs(routePoints: RoutePoint[]) {
  const legs: RouteLeg[] = [];
  let previousKnownSpeed: number | null = null;

  for (let index = 0; index < routePoints.length - 1; index++) {
    const from = routePoints[index]!;
    const to = routePoints[index + 1]!;
    const explicitSpeed = parseSpeedKts(to.spd) ?? parseSpeedKts(from.spd);
    const plannedSpeedKts: number =
      explicitSpeed ??
      previousKnownSpeed ??
      estimateFallbackSpeedKts(from, to);

    if (explicitSpeed) {
      previousKnownSpeed = explicitSpeed;
    } else if (previousKnownSpeed === null) {
      previousKnownSpeed = plannedSpeedKts;
    }

    legs.push({
      fromRoutePointIndex: index,
      toRoutePointIndex: index + 1,
      fromWaypointIndex: from.waypointIndex,
      toWaypointIndex: to.waypointIndex,
      distanceNm: calculateDistanceNm(from.lat, from.lon, to.lat, to.lon),
      plannedSpeedKts,
    });
  }

  return legs;
}

function resolveMatchedLegIndex(
  nextWaypoint: string | undefined,
  routePoints: RoutePoint[],
  legs: RouteLeg[],
) {
  const normalizedNextWaypoint = normalizeWaypointIdent(nextWaypoint);
  if (!normalizedNextWaypoint) return null;

  const routePointIndex = routePoints.findIndex(
    (routePoint) => normalizeWaypointIdent(routePoint.ident) === normalizedNextWaypoint,
  );
  if (routePointIndex <= 0) return null;

  return legs.findIndex((leg) => leg.toRoutePointIndex === routePointIndex);
}

function findBestLegIndex(
  aircraft: Pick<PositionUpdate, "lat" | "lon" | "nextWaypoint">,
  routePoints: RoutePoint[],
  legs: RouteLeg[],
) {
  let bestLegIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < legs.length; index++) {
    const leg = legs[index]!;
    const from = routePoints[leg.fromRoutePointIndex]!;
    const to = routePoints[leg.toRoutePointIndex]!;
    const projection = getProjectedPointOnLeg(aircraft, from, to);
    const score = projection.offTrackDistanceNm;

    if (score < bestScore) {
      bestLegIndex = index;
      bestScore = score;
    }
  }

  const matchedLegIndex = resolveMatchedLegIndex(
    aircraft.nextWaypoint,
    routePoints,
    legs,
  );

  if (matchedLegIndex !== null && matchedLegIndex >= 0) {
    const matchedLeg = legs[matchedLegIndex]!;
    const from = routePoints[matchedLeg.fromRoutePointIndex]!;
    const to = routePoints[matchedLeg.toRoutePointIndex]!;
    const projection = getProjectedPointOnLeg(aircraft, from, to);

    if (projection.offTrackDistanceNm <= 80 || matchedLegIndex === bestLegIndex) {
      return matchedLegIndex;
    }
  }

  return bestLegIndex;
}

function resolveCurrentGroundSpeedKts(
  aircraft: PositionUpdate,
  fallbackSpeedKts: number,
) {
  const candidates = [
    aircraft.etaObservedGroundSpeed,
    aircraft.groundSpeed,
    aircraft.observedGroundSpeed,
    aircraft.speed,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= MIN_PLAUSIBLE_GROUND_SPEED_KTS &&
      candidate <= MAX_PLAUSIBLE_GROUND_SPEED_KTS
    ) {
      return candidate;
    }
  }

  return fallbackSpeedKts;
}

function isAirborne(aircraft: PositionUpdate) {
  return Number(aircraft.alt ?? 0) > 100 || Number(aircraft.speed ?? 0) > 60;
}

export function calculateFlightProgress(
  aircraft: PositionUpdate,
  waypoints: LiveFlightPlanWaypoint[],
  nowMs = Date.now(),
): FlightProgressSnapshot | null {
  const routePoints = buildRoutePoints(waypoints);
  if (routePoints.length < 2) return null;

  const legs = buildRouteLegs(routePoints);
  if (legs.length === 0) return null;

  const totalDistanceNm = legs.reduce((sum, leg) => sum + leg.distanceNm, 0);
  if (!Number.isFinite(totalDistanceNm) || totalDistanceNm <= 0) return null;

  const legIndex = findBestLegIndex(aircraft, routePoints, legs);
  const currentLeg = legs[legIndex]!;
  const from = routePoints[currentLeg.fromRoutePointIndex]!;
  const to = routePoints[currentLeg.toRoutePointIndex]!;
  const projection = getProjectedPointOnLeg(aircraft, from, to);

  let traveledDistanceNm = 0;
  for (let index = 0; index < legIndex; index++) {
    traveledDistanceNm += legs[index]!.distanceNm;
  }
  traveledDistanceNm += currentLeg.distanceNm * projection.fraction;
  traveledDistanceNm = clamp(traveledDistanceNm, 0, totalDistanceNm);

  const remainingDistanceNm = Math.max(0, totalDistanceNm - traveledDistanceNm);
  const progressRatio = totalDistanceNm > 0 ? traveledDistanceNm / totalDistanceNm : 0;
  const fallbackSpeedKts = currentLeg.plannedSpeedKts;
  const currentGroundSpeedKts = resolveCurrentGroundSpeedKts(
    aircraft,
    fallbackSpeedKts,
  );
  const speedScale =
    currentLeg.plannedSpeedKts > 0
      ? clamp(currentGroundSpeedKts / currentLeg.plannedSpeedKts, 0.55, 1.85)
      : 1;

  const adjustedLegSpeed = (leg: RouteLeg) =>
    clamp(leg.plannedSpeedKts * speedScale, 140, MAX_PLAUSIBLE_GROUND_SPEED_KTS);

  let elapsedMinutes = 0;
  for (let index = 0; index < legIndex; index++) {
    const leg = legs[index]!;
    elapsedMinutes += (leg.distanceNm / adjustedLegSpeed(leg)) * 60;
  }
  elapsedMinutes +=
    ((currentLeg.distanceNm * projection.fraction) /
      adjustedLegSpeed(currentLeg)) *
    60;

  let remainingMinutes = 0;
  remainingMinutes +=
    ((currentLeg.distanceNm * (1 - projection.fraction)) /
      adjustedLegSpeed(currentLeg)) *
    60;

  const waypointEtas: FlightProgressWaypointEta[] = waypoints.map(
    (waypoint, index) => ({
      index,
      ident: waypoint.ident,
      type: waypoint.type,
      etaTs: null,
      distanceRemainingNm: null,
      isActive: index === currentLeg.toWaypointIndex,
      isPassed:
        waypoint.routePointIndex !== null &&
        waypoint.routePointIndex < currentLeg.toRoutePointIndex,
    }),
  );

  let minutesFromNow = remainingMinutes;
  let distanceFromAircraftNm = currentLeg.distanceNm * (1 - projection.fraction);

  waypointEtas[currentLeg.toWaypointIndex] = {
    ...waypointEtas[currentLeg.toWaypointIndex]!,
    etaTs: nowMs + minutesFromNow * 60_000,
    distanceRemainingNm: distanceFromAircraftNm,
    isPassed: false,
  };

  for (let index = legIndex + 1; index < legs.length; index++) {
    const leg = legs[index]!;
    const legMinutes = (leg.distanceNm / adjustedLegSpeed(leg)) * 60;
    minutesFromNow += legMinutes;
    remainingMinutes += legMinutes;
    distanceFromAircraftNm += leg.distanceNm;

    waypointEtas[leg.toWaypointIndex] = {
      ...waypointEtas[leg.toWaypointIndex]!,
      etaTs: nowMs + minutesFromNow * 60_000,
      distanceRemainingNm: distanceFromAircraftNm,
      isPassed: false,
    };
  }

  const parsedTakeoffTime = Date.parse(aircraft.takeoffTime || "");
  const hasReportedDeparture = Number.isFinite(parsedTakeoffTime);
  const departureTimeTs = hasReportedDeparture
    ? parsedTakeoffTime
    : isAirborne(aircraft) && elapsedMinutes > 0
      ? nowMs - elapsedMinutes * 60_000
      : null;

  return {
    progressRatio,
    progressPercent: Math.round(progressRatio * 100),
    totalDistanceNm,
    traveledDistanceNm,
    remainingDistanceNm,
    elapsedMinutes: Number.isFinite(elapsedMinutes) ? elapsedMinutes : null,
    remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
    departureTimeTs,
    departureTimeSource:
      departureTimeTs === null
        ? null
        : hasReportedDeparture
          ? "reported"
          : "estimated",
    arrivalEtaTs:
      Number.isFinite(remainingMinutes) ? nowMs + remainingMinutes * 60_000 : null,
    activeWaypointIndex: currentLeg.toWaypointIndex,
    currentLegToWaypointIndex: currentLeg.toWaypointIndex,
    currentGroundSpeedKts,
    waypointEtas,
  };
}
