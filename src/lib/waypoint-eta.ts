import { type PositionUpdate } from "~/lib/aircraft-store";
import { findActiveWaypointIndex } from "~/lib/map-utils";

const EARTH_RADIUS_NM = 3440.065;
const MIN_ETA_SPEED_KTS = 30;

export interface WaypointEta {
  status: "passed" | "upcoming" | "unknown";
  etaTs: number | null;
  etaText: string;
  remainingText: string;
  distanceNm: number | null;
}

const toRadians = (value: number) => (value * Math.PI) / 180;

export const distanceNm = (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) => {
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
};

export const parseWaypointPosition = (
  waypoint: Record<string, unknown>,
): [number, number] | null => {
  const lat =
    typeof waypoint.lat === "number"
      ? waypoint.lat
      : typeof waypoint.latitude === "number"
        ? waypoint.latitude
        : null;
  const lon =
    typeof waypoint.lon === "number"
      ? waypoint.lon
      : typeof waypoint.lng === "number"
        ? waypoint.lng
        : typeof waypoint.longitude === "number"
          ? waypoint.longitude
          : null;

  if (lat === null || lon === null) return null;
  return [lat, lon];
};

export const formatClockTime = (timestamp: number | null) => {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}z`;
};

export const formatDuration = (minutes: number | null) => {
  if (minutes === null || !Number.isFinite(minutes)) return "--";
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
};

export const getEtaSpeedKts = (aircraft: PositionUpdate) => {
  const speedKts = Number(
    aircraft.etaObservedGroundSpeed ??
      aircraft.observedGroundSpeed ??
      aircraft.speed ??
      0,
  );
  return Number.isFinite(speedKts) ? Math.max(0, speedKts) : 0;
};

interface NormalizedWaypoint {
  index: number;
  lat: number;
  lon: number;
  ident: string | null;
}

interface RouteProgressState {
  nextIndex: number;
  distanceToNextNm: number;
  waypoints: NormalizedWaypoint[];
}

function normalizeWaypoints(waypoints: Record<string, unknown>[]) {
  return waypoints
    .map((wp, index) => {
      const point = parseWaypointPosition(wp);
      if (!point) return null;

      return {
        index,
        lat: point[0],
        lon: point[1],
        ident: typeof wp.ident === "string" ? wp.ident.trim().toUpperCase() : null,
      };
    })
    .filter((wp): wp is NormalizedWaypoint => wp !== null);
}

function resolveMatchedWaypointIndex(
  waypoints: Record<string, unknown>[],
  nextWaypointIdent?: string | null,
): number | null {
  if (!nextWaypointIdent) return null;

  const normalizedIdent = nextWaypointIdent.trim().toUpperCase();
  const matches = normalizeWaypoints(waypoints).filter(
    (candidate) => candidate.ident === normalizedIdent,
  );

  if (matches.length === 1) return matches[0]!.index;
  return null;
}

function projectPointToSegmentNm(
  point: [number, number],
  from: [number, number],
  to: [number, number],
) {
  const avgLatRad = toRadians((from[0] + to[0] + point[0]) / 3);
  const cosLat = Math.max(0.2, Math.cos(avgLatRad));

  const ax = from[1] * cosLat * 60;
  const ay = from[0] * 60;
  const bx = to[1] * cosLat * 60;
  const by = to[0] * 60;
  const px = point[1] * cosLat * 60;
  const py = point[0] * 60;

  const abx = bx - ax;
  const aby = by - ay;
  const abLengthSquared = abx * abx + aby * aby;
  if (abLengthSquared <= 1e-6) {
    return {
      distanceToSegmentNm: Math.hypot(px - ax, py - ay),
      remainingOnSegmentNm: 0,
      segmentLengthNm: 0,
      t: 0,
    };
  }

  const apx = px - ax;
  const apy = py - ay;
  const unclampedT = (apx * abx + apy * aby) / abLengthSquared;
  const t = Math.max(0, Math.min(1, unclampedT));
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  const segmentLengthNm = Math.sqrt(abLengthSquared);

  return {
    distanceToSegmentNm: Math.hypot(px - closestX, py - closestY),
    remainingOnSegmentNm: segmentLengthNm * (1 - t),
    segmentLengthNm,
    t,
  };
}

function resolveRouteProgress(
  aircraft: PositionUpdate,
  waypoints: Record<string, unknown>[],
): RouteProgressState | null {
  const normalizedWaypoints = normalizeWaypoints(waypoints);
  if (normalizedWaypoints.length === 0) return null;

  if (normalizedWaypoints.length === 1) {
    return {
      nextIndex: normalizedWaypoints[0]!.index,
      distanceToNextNm: distanceNm(
        aircraft.lat,
        aircraft.lon,
        normalizedWaypoints[0]!.lat,
        normalizedWaypoints[0]!.lon,
      ),
      waypoints: normalizedWaypoints,
    };
  }

  const aircraftPoint: [number, number] = [Number(aircraft.lat), Number(aircraft.lon)];
  if (!Number.isFinite(aircraftPoint[0]) || !Number.isFinite(aircraftPoint[1])) {
    return null;
  }

  const matchedNextIndex = resolveMatchedWaypointIndex(
    waypoints,
    aircraft.nextWaypoint,
  );

  let bestLeg:
    | {
        nextIndex: number;
        distanceToSegmentNm: number;
        remainingOnSegmentNm: number;
      }
    | null = null;

  for (let index = 0; index < normalizedWaypoints.length - 1; index++) {
    const from = normalizedWaypoints[index];
    const to = normalizedWaypoints[index + 1];
    if (!from || !to) continue;

    const projection = projectPointToSegmentNm(
      aircraftPoint,
      [from.lat, from.lon],
      [to.lat, to.lon],
    );

    let score = projection.distanceToSegmentNm;
    if (matchedNextIndex !== null) {
      const delta = Math.abs(to.index - matchedNextIndex);
      if (delta === 0) score -= 2;
      else score += delta * 5;
    }

    if (!bestLeg || score < bestLeg.distanceToSegmentNm) {
      bestLeg = {
        nextIndex: to.index,
        distanceToSegmentNm: score,
        remainingOnSegmentNm: projection.remainingOnSegmentNm,
      };
    }
  }

  if (!bestLeg) {
    const activeWaypointListIndex = findActiveWaypointIndex(
      aircraft,
      normalizedWaypoints,
    );
    if (activeWaypointListIndex < 0) return null;

    const fallbackWaypoint = normalizedWaypoints[activeWaypointListIndex];
    if (!fallbackWaypoint) return null;

    return {
      nextIndex: fallbackWaypoint.index,
      distanceToNextNm: distanceNm(
        aircraft.lat,
        aircraft.lon,
        fallbackWaypoint.lat,
        fallbackWaypoint.lon,
      ),
      waypoints: normalizedWaypoints,
    };
  }

  return {
    nextIndex: bestLeg.nextIndex,
    distanceToNextNm: Math.max(0, bestLeg.remainingOnSegmentNm),
    waypoints: normalizedWaypoints,
  };
}

export const calculateWaypointEtas = (
  aircraft: PositionUpdate,
  waypoints: Record<string, unknown>[],
  now = Date.now(),
): WaypointEta[] => {
  const routeProgress = resolveRouteProgress(aircraft, waypoints);
  const nextIndex = routeProgress?.nextIndex ?? -1;
  const baseEtas = waypoints.map<WaypointEta>((_, index) => ({
    status: nextIndex >= 0 && index < nextIndex ? "passed" : "unknown",
    etaTs: null,
    etaText: nextIndex >= 0 && index < nextIndex ? "Passed" : "--:--",
    remainingText: "--",
    distanceNm: null,
  }));

  if (nextIndex < 0 || !routeProgress) return baseEtas;

  const speedKts = getEtaSpeedKts(aircraft);
  if (speedKts < MIN_ETA_SPEED_KTS) return baseEtas;

  let cumulativeDistanceNm = routeProgress.distanceToNextNm;
  const nextWaypointListIndex = routeProgress.waypoints.findIndex(
    (wp) => wp.index === routeProgress.nextIndex,
  );
  if (nextWaypointListIndex < 0) return baseEtas;

  for (
    let waypointListIndex = nextWaypointListIndex;
    waypointListIndex < routeProgress.waypoints.length;
    waypointListIndex++
  ) {
    const currentWaypoint = routeProgress.waypoints[waypointListIndex];
    if (!currentWaypoint) continue;

    if (waypointListIndex > nextWaypointListIndex) {
      const previousWaypoint = routeProgress.waypoints[waypointListIndex - 1];
      if (!previousWaypoint) continue;
      cumulativeDistanceNm += distanceNm(
        previousWaypoint.lat,
        previousWaypoint.lon,
        currentWaypoint.lat,
        currentWaypoint.lon,
      );
    }

    const etaTs = now + (cumulativeDistanceNm / speedKts) * 3_600_000;
    baseEtas[currentWaypoint.index] = {
      status: "upcoming",
      etaTs,
      etaText: formatClockTime(etaTs),
      remainingText: formatDuration((etaTs - now) / 60_000),
      distanceNm: cumulativeDistanceNm,
    };
  }

  return baseEtas;
};

export const calculateRemainingDistanceNm = (
  aircraft: PositionUpdate,
  waypoints: Record<string, unknown>[],
) => {
  const routeProgress = resolveRouteProgress(aircraft, waypoints);
  if (!routeProgress) return null;

  const nextWaypointListIndex = routeProgress.waypoints.findIndex(
    (wp) => wp.index === routeProgress.nextIndex,
  );
  if (nextWaypointListIndex < 0) return null;

  let distance = routeProgress.distanceToNextNm;

  for (
    let waypointListIndex = nextWaypointListIndex + 1;
    waypointListIndex < routeProgress.waypoints.length;
    waypointListIndex++
  ) {
    const previousWaypoint = routeProgress.waypoints[waypointListIndex - 1];
    const currentWaypoint = routeProgress.waypoints[waypointListIndex];
    if (!previousWaypoint || !currentWaypoint) continue;

    distance += distanceNm(
      previousWaypoint.lat,
      previousWaypoint.lon,
      currentWaypoint.lat,
      currentWaypoint.lon,
    );
  }

  return distance > 1 ? distance : null;
};
