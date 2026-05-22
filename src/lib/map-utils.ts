// lib/map-utils.ts

import { type PositionUpdate } from "~/lib/aircraft-store";

const EARTH_RADIUS_KM = 6371;
const MILES_TO_KM = 1.609344;

export const SELECTED_AIRPORT_RADIUS_MILES = 5;
export const SELECTED_AIRPORT_RADIUS_METERS =
  SELECTED_AIRPORT_RADIUS_MILES * 1609.344;

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: "km" | "miles" = "km",
): number => {
  const R_miles = 3958.8;

  const R = unit === "miles" ? R_miles : EARTH_RADIUS_KM;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const createGeodesicCircle = (
  lat: number,
  lon: number,
  radiusMiles: number,
  points = 64,
): [number, number][] => {
  const angularDistance = (radiusMiles * MILES_TO_KM) / EARTH_RADIUS_KM;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const bearing = (2 * Math.PI * i) / points;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinAngularDistance = Math.sin(angularDistance);
    const cosAngularDistance = Math.cos(angularDistance);

    const destLat = Math.asin(
      sinLat * cosAngularDistance +
        cosLat * sinAngularDistance * Math.cos(bearing),
    );
    const destLon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * sinAngularDistance * cosLat,
        cosAngularDistance - sinLat * Math.sin(destLat),
      );

    const normalizedLon =
      ((((destLon * 180) / Math.PI) + 540) % 360) - 180;

    coordinates.push([normalizedLon, (destLat * 180) / Math.PI]);
  }

  return coordinates;
};

export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));

  return (θ + 360) % 360;
};

function isValidLatLonPoint(
  point: [number, number] | undefined,
): point is [number, number] {
  return Boolean(
    point &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
}

export function getRadarLineBearing(aircraft: PositionUpdate): number {
  const fallbackBearing = Number.isFinite(aircraft.heading)
    ? (aircraft.heading + 180) % 360
    : 0;
  const currentPoint: [number, number] = [aircraft.lat, aircraft.lon];

  if (!isValidLatLonPoint(currentPoint)) {
    return fallbackBearing;
  }

  const trailPath = (aircraft.trailSamples ?? [])
    .map((sample) => [sample.lat, sample.lon] as [number, number])
    .filter(isValidLatLonPoint);
  const historyPath =
    trailPath.length > 0
      ? trailPath
      : (aircraft.flightPath ?? []).filter(isValidLatLonPoint);

  if (historyPath.length === 0) {
    return fallbackBearing;
  }

  const lastHistoryPoint = historyPath[historyPath.length - 1];
  const pathWithCurrent =
    lastHistoryPoint &&
    lastHistoryPoint[0] === currentPoint[0] &&
    lastHistoryPoint[1] === currentPoint[1]
      ? historyPath
      : [...historyPath, currentPoint];
  const unwrappedPath = unwrapPath(pathWithCurrent);
  const latestPoint = unwrappedPath[unwrappedPath.length - 1];

  if (!latestPoint) {
    return fallbackBearing;
  }

  for (let index = unwrappedPath.length - 2; index >= 0; index -= 1) {
    const previousPoint = unwrappedPath[index];
    if (
      !previousPoint ||
      (previousPoint[0] === latestPoint[0] &&
        previousPoint[1] === latestPoint[1])
    ) {
      continue;
    }

    return calculateBearing(
      latestPoint[0],
      latestPoint[1],
      previousPoint[0],
      previousPoint[1],
    );
  }

  return fallbackBearing;
}

/**
 * Make a path's longitudes continuous so it renders on one side of the map.
 * Use this when you control both the markers and the polyline (e.g. flight plans),
 * so everything appears together without splitting across the antimeridian.
 */
export function unwrapPath(path: [number, number][]): [number, number][] {
  if (path.length < 2) return path;

  const result: [number, number][] = [[path[0]![0], path[0]![1]]];

  for (let i = 1; i < path.length; i++) {
    const prevLon = result[i - 1]![1];
    let currLon = path[i]![1];

    while (currLon - prevLon > 180) currLon -= 360;
    while (currLon - prevLon < -180) currLon += 360;

    result.push([path[i]![0], currLon]);
  }

  return result;
}

/**
 * Shift an already-unwrapped path onto the world copy nearest a reference
 * longitude so Leaflet can keep the whole route visually continuous.
 */
export function shiftPathToReferenceLongitude(
  path: [number, number][],
  referenceLon?: number,
): [number, number][] {
  if (path.length === 0 || referenceLon === undefined) return path;

  const lons = path.map(([, lon]) => lon);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const centerLon = (minLon + maxLon) / 2;
  const shift = Math.round((referenceLon - centerLon) / 360) * 360;

  if (shift === 0) return path;

  return path.map(([lat, lon]) => [lat, lon + shift] as [number, number]);
}

/**
 * Prepare a path for display on a single Leaflet world copy.
 */
export function preparePathForWorldCopy(
  path: [number, number][],
  referenceLon?: number,
): [number, number][] {
  return shiftPathToReferenceLongitude(unwrapPath(path), referenceLon);
}

/**
 * Split a path into segments at antimeridian (±180°) crossings.
 * Each segment stays within the standard [-180, 180] longitude range,
 * so Leaflet draws polylines correctly without stretching across the map.
 */
export function splitPathAtAntimeridian(
  path: [number, number][],
): [number, number][][] {
  if (path.length < 2) return path.length > 0 ? [path] : [];

  const segments: [number, number][][] = [];
  let current: [number, number][] = [path[0]!];

  for (let i = 1; i < path.length; i++) {
    const [lat1, lon1] = path[i - 1]!;
    const [lat2, lon2] = path[i]!;
    const diff = lon2 - lon1;

    if (Math.abs(diff) > 180) {
      // Antimeridian crossing detected.
      // Wrap lon2 to be continuous with lon1, then find the ±180 crossing.
      const wrapOffset = diff > 0 ? -360 : 360;
      const adjustedLon2 = lon2 + wrapOffset;
      const boundary = diff > 0 ? -180 : 180;

      const t = (boundary - lon1) / (adjustedLon2 - lon1);
      const crossLat = lat1 + t * (lat2 - lat1);

      current.push([crossLat, boundary]);
      segments.push(current);
      current = [
        [crossLat, -boundary],
        [lat2, lon2],
      ];
    } else {
      current.push([lat2, lon2]);
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

export const findActiveWaypointIndex = (
  aircraft: PositionUpdate,
  waypoints: any[],
): number => {
  if (waypoints.length < 1) return -1;

  const currentLat = aircraft.lat;
  const currentLon = aircraft.lon;
  const currentHeading = aircraft.heading;

  let closestWaypointIndex = -1;
  let minDistanceKm = Infinity;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (!wp.lat || !wp.lon) continue;

    const distance = calculateDistance(currentLat, currentLon, wp.lat, wp.lon);

    if (distance < minDistanceKm) {
      minDistanceKm = distance;
      closestWaypointIndex = i;
    }
  }

  if (minDistanceKm > 100) {
    return -1;
  }

  if (minDistanceKm < 50 && closestWaypointIndex < waypoints.length - 1) {
    const nextWp = waypoints[closestWaypointIndex + 1];
    if (nextWp.lat && nextWp.lon) {
      const bearingToNext = calculateBearing(
        currentLat,
        currentLon,
        nextWp.lat,
        nextWp.lon,
      );

      let headingDiff = Math.abs(currentHeading - bearingToNext);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;

      if (headingDiff < 90) {
        return closestWaypointIndex + 1;
      }
    }
  }

  return closestWaypointIndex;
};
