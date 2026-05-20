import {
  type PositionUpdate,
  type TimedPositionSample,
} from "~/lib/aircraft-store";
import { unwrapPath } from "~/lib/map-utils";
import {
  type RadarTrailPreferences,
  DEFAULT_RADAR_TRAIL_PREFERENCES,
} from "~/lib/radarTrailPreferences";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getBearingDegrees(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
) {
  const startLat = toRadians(fromLat);
  const endLat = toRadians(toLat);
  const deltaLon = toRadians(toLon - fromLon);
  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function distanceNm(
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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3440.065 * c;
}

function getFallbackBearing(aircraft: PositionUpdate) {
  return ((aircraft.heading || 0) + 180) % 360;
}

function interpolatePoint(
  fromPoint: [number, number],
  toPoint: [number, number],
  ratio: number,
): [number, number] {
  return [
    fromPoint[0] + (toPoint[0] - fromPoint[0]) * ratio,
    fromPoint[1] + (toPoint[1] - fromPoint[1]) * ratio,
  ];
}

function unwrapTimedSamples(samples: TimedPositionSample[]) {
  const unwrapped = unwrapPath(
    samples.map((sample) => [sample.lat, sample.lon] as [number, number]),
  );
  return samples.map((sample, index) => ({
    ...sample,
    lat: unwrapped[index]?.[0] ?? sample.lat,
    lon: unwrapped[index]?.[1] ?? sample.lon,
  }));
}

function buildTimeTrailSamples(aircraft: PositionUpdate) {
  const currentTs = Number.isFinite(aircraft.ts) ? aircraft.ts : Date.now();
  const baseSamples = aircraft.trailSamples ?? [];
  const nextSamples = [...baseSamples];
  const lastSample = nextSamples[nextSamples.length - 1];

  if (!lastSample || currentTs > lastSample.ts) {
    nextSamples.push({
      lat: aircraft.lat,
      lon: aircraft.lon,
      ts: currentTs,
    });
  }

  return unwrapTimedSamples(nextSamples);
}

function getPointAtTimeOffset(
  samples: TimedPositionSample[],
  targetOffsetMs: number,
): [number, number] | null {
  if (samples.length < 2) return null;

  const newest = samples[samples.length - 1];
  if (!newest) return null;

  const targetTs = newest.ts - targetOffsetMs;
  if (targetTs < samples[0]!.ts) return null;

  for (let index = samples.length - 1; index > 0; index -= 1) {
    const newer = samples[index];
    const older = samples[index - 1];
    if (!newer || !older || newer.ts <= older.ts) continue;

    if (targetTs < older.ts || targetTs > newer.ts) continue;

    const ratio = (targetTs - older.ts) / (newer.ts - older.ts);
    return interpolatePoint(
      [older.lat, older.lon],
      [newer.lat, newer.lon],
      ratio,
    );
  }

  return null;
}

function buildDistanceTrailPath(aircraft: PositionUpdate) {
  const currentPoint: [number, number] = [aircraft.lat, aircraft.lon];
  const path = aircraft.flightPath ?? [];
  const lastPathPoint = path[path.length - 1];
  return unwrapPath(
    lastPathPoint?.[0] === currentPoint[0] &&
      lastPathPoint?.[1] === currentPoint[1]
      ? path
      : [...path, currentPoint],
  );
}

function getPointAtDistanceOffset(
  path: [number, number][],
  targetDistanceNm: number,
): [number, number] | null {
  if (path.length < 2) return null;

  let traversedDistanceNm = 0;

  for (let index = path.length - 1; index > 0; index -= 1) {
    const segmentEnd = path[index];
    const segmentStart = path[index - 1];
    if (!segmentEnd || !segmentStart) continue;

    const segmentDistanceNm = distanceNm(
      segmentStart[0],
      segmentStart[1],
      segmentEnd[0],
      segmentEnd[1],
    );
    if (segmentDistanceNm <= 0) continue;

    if (traversedDistanceNm + segmentDistanceNm >= targetDistanceNm) {
      const remainingDistanceNm = targetDistanceNm - traversedDistanceNm;
      const ratio = remainingDistanceNm / segmentDistanceNm;
      return interpolatePoint(segmentEnd, segmentStart, ratio);
    }

    traversedDistanceNm += segmentDistanceNm;
  }

  return null;
}

export function getRadarTrailBearings(
  aircraft: PositionUpdate,
  maxDots: number,
  preferences: RadarTrailPreferences = DEFAULT_RADAR_TRAIL_PREFERENCES,
): number[] {
  const fallbackBearing = getFallbackBearing(aircraft);
  if (
    !Number.isFinite(aircraft.lat) ||
    !Number.isFinite(aircraft.lon) ||
    maxDots <= 0
  ) {
    return [];
  }

  const timeSamples =
    preferences.mode === "minutes" ? buildTimeTrailSamples(aircraft) : null;
  const distancePath =
    preferences.mode === "nm" ? buildDistanceTrailPath(aircraft) : null;
  const currentLat =
    preferences.mode === "minutes"
      ? (timeSamples?.[timeSamples.length - 1]?.lat ?? aircraft.lat)
      : (distancePath?.[distancePath.length - 1]?.[0] ?? aircraft.lat);
  const currentLon =
    preferences.mode === "minutes"
      ? (timeSamples?.[timeSamples.length - 1]?.lon ?? aircraft.lon)
      : (distancePath?.[distancePath.length - 1]?.[1] ?? aircraft.lon);
  const interval =
    preferences.mode === "minutes"
      ? preferences.minutes
      : preferences.distanceNm;

  const bearings: number[] = [];
  let lastBearing = fallbackBearing;

  for (let dotIndex = 0; dotIndex < maxDots; dotIndex += 1) {
    const targetValue =
      preferences.mode === "minutes"
        ? interval * ((dotIndex + 1) / maxDots)
        : interval * (dotIndex + 1);
    const point =
      preferences.mode === "minutes"
        ? getPointAtTimeOffset(timeSamples ?? [], targetValue * 60_000)
        : getPointAtDistanceOffset(distancePath ?? [], targetValue);

    if (point) {
      lastBearing = getBearingDegrees(currentLat, currentLon, point[0], point[1]);
    }

    bearings.push(lastBearing);
  }

  return bearings;
}
