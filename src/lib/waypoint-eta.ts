import { type PositionUpdate } from "~/lib/aircraft-store";

const EARTH_RADIUS_NM = 3440.065;
const MIN_ETA_GROUND_SPEED_KTS = 30;

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

export const getEtaGroundSpeedKts = (aircraft: PositionUpdate) => {
  const groundSpeed = Number(aircraft.groundSpeed ?? aircraft.speed ?? 0);
  return Number.isFinite(groundSpeed) ? Math.max(0, groundSpeed) : 0;
};

const findNextWaypointIndex = (
  waypoints: Record<string, unknown>[],
  nextWaypointIdent?: string | null,
) => {
  if (waypoints.length === 0) return -1;
  if (!nextWaypointIdent) return 0;

  const nextIndex = waypoints.findIndex(
    (wp) =>
      typeof wp.ident === "string" &&
      wp.ident.toUpperCase() === nextWaypointIdent.toUpperCase(),
  );

  return nextIndex >= 0 ? nextIndex : 0;
};

export const calculateWaypointEtas = (
  aircraft: PositionUpdate,
  waypoints: Record<string, unknown>[],
  now = Date.now(),
): WaypointEta[] => {
  const nextIndex = findNextWaypointIndex(waypoints, aircraft.nextWaypoint);
  const baseEtas = waypoints.map<WaypointEta>((_, index) => ({
    status: nextIndex >= 0 && index < nextIndex ? "passed" : "unknown",
    etaTs: null,
    etaText: nextIndex >= 0 && index < nextIndex ? "Passed" : "--:--",
    remainingText: "--",
    distanceNm: null,
  }));

  if (nextIndex < 0) return baseEtas;

  const groundSpeed = getEtaGroundSpeedKts(aircraft);
  if (groundSpeed < MIN_ETA_GROUND_SPEED_KTS) return baseEtas;

  const currentLat = Number(aircraft.lat);
  const currentLon = Number(aircraft.lon);
  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLon)) {
    return baseEtas;
  }

  let previous: [number, number] | null = [currentLat, currentLon];
  let cumulativeDistanceNm = 0;

  for (let index = nextIndex; index < waypoints.length; index++) {
    const point = parseWaypointPosition(waypoints[index]!);
    if (!point || !previous) {
      if (point) previous = point;
      continue;
    }

    cumulativeDistanceNm += distanceNm(
      previous[0],
      previous[1],
      point[0],
      point[1],
    );

    const etaTs = now + (cumulativeDistanceNm / groundSpeed) * 3_600_000;
    baseEtas[index] = {
      status: "upcoming",
      etaTs,
      etaText: formatClockTime(etaTs),
      remainingText: formatDuration((etaTs - now) / 60_000),
      distanceNm: cumulativeDistanceNm,
    };
    previous = point;
  }

  return baseEtas;
};

export const calculateRemainingDistanceNm = (
  aircraft: PositionUpdate,
  waypoints: Record<string, unknown>[],
) => {
  const nextIndex = findNextWaypointIndex(waypoints, aircraft.nextWaypoint);
  if (nextIndex < 0) return null;

  const currentLat = Number(aircraft.lat);
  const currentLon = Number(aircraft.lon);
  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLon)) {
    return null;
  }

  let previous: [number, number] | null = [currentLat, currentLon];
  let distance = 0;

  for (let index = nextIndex; index < waypoints.length; index++) {
    const point = parseWaypointPosition(waypoints[index]!);
    if (!point || !previous) {
      if (point) previous = point;
      continue;
    }

    distance += distanceNm(previous[0], previous[1], point[0], point[1]);
    previous = point;
  }

  return distance > 1 ? distance : null;
};
