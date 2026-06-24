import { type Runway } from "~/hooks/useAirportData";
import { calculateBearing } from "~/lib/map-utils";

const EARTH_RADIUS_NM = 3440.065;

export interface RunwayCenterlinePreferences {
  enabled: boolean;
  lengthNm: number;
}

export const DEFAULT_RUNWAY_CENTERLINE_PREFERENCES: RunwayCenterlinePreferences =
  {
    enabled: true,
    lengthNm: 10,
  };

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeLon(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function destinationPoint(
  lat: number,
  lon: number,
  bearingDegrees: number,
  distanceNm: number,
): [number, number] {
  const angularDistance = distanceNm / EARTH_RADIUS_NM;
  const bearing = toRadians(bearingDegrees);
  const latRad = toRadians(lat);
  const lonRad = toRadians(lon);

  const destLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destLon =
    lonRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLat),
    );

  return [toDegrees(destLat), normalizeLon(toDegrees(destLon))];
}

function isValidPoint(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function clampRunwayCenterlineLength(value: number) {
  return Math.min(25, Math.max(3, Math.round(value)));
}

export function normalizeRunwayCenterlinePreferences(
  preferences: Partial<RunwayCenterlinePreferences> | null | undefined,
): RunwayCenterlinePreferences {
  return {
    enabled:
      typeof preferences?.enabled === "boolean"
        ? preferences.enabled
        : DEFAULT_RUNWAY_CENTERLINE_PREFERENCES.enabled,
    lengthNm: clampRunwayCenterlineLength(
      preferences?.lengthNm ?? DEFAULT_RUNWAY_CENTERLINE_PREFERENCES.lengthNm,
    ),
  };
}

export function buildRunwayCenterlinePaths(
  runway: Runway,
  preferences: RunwayCenterlinePreferences,
): [number, number][][] {
  if (!preferences.enabled) return [];
  if (
    !isValidPoint(runway.leLat, runway.leLon) ||
    !isValidPoint(runway.heLat, runway.heLon)
  ) {
    return [];
  }

  const leToHeBearing = calculateBearing(
    runway.leLat,
    runway.leLon,
    runway.heLat,
    runway.heLon,
  );
  const heToLeBearing = (leToHeBearing + 180) % 360;
  const leExtension = destinationPoint(
    runway.leLat,
    runway.leLon,
    heToLeBearing,
    preferences.lengthNm,
  );
  const heExtension = destinationPoint(
    runway.heLat,
    runway.heLon,
    leToHeBearing,
    preferences.lengthNm,
  );

  return [
    [leExtension, [runway.leLat, runway.leLon]],
    [[runway.heLat, runway.heLon], heExtension],
  ];
}
