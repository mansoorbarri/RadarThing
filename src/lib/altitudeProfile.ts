export interface AltitudeProfile {
  altitudes: number[];
  isEstimated: boolean;
}

const DEFAULT_CRUISE_ALTITUDE_FT = 35_000;

function smoothStep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function recordedAltitude(point: unknown): number | null {
  if (!Array.isArray(point) || point.length < 3) return null;

  const altitude = Number(point[2]);
  return Number.isFinite(altitude) && altitude >= -1_500 && altitude <= 100_000
    ? Math.max(0, altitude)
    : null;
}

/**
 * Builds the vertical profile used by the replay altitude curtain. New route
 * data may carry altitude as a third tuple value. Legacy flights only have
 * latitude/longitude, so they receive a conservative visual estimate based on
 * the recorded maximum altitude.
 */
export function buildAltitudeProfile(
  routeData: readonly unknown[],
  maxAltitude?: number,
): AltitudeProfile {
  const recorded = routeData.map(recordedAltitude);
  if (recorded.length > 0 && recorded.every((value) => value !== null)) {
    return {
      altitudes: recorded.map((value) => value ?? 0),
      isEstimated: false,
    };
  }

  const peak =
    typeof maxAltitude === "number" && Number.isFinite(maxAltitude)
      ? Math.max(0, maxAltitude)
      : DEFAULT_CRUISE_ALTITUDE_FT;
  const lastIndex = Math.max(1, routeData.length - 1);

  return {
    altitudes: routeData.map((_, index) => {
      const progress = index / lastIndex;
      if (progress < 0.2) return peak * smoothStep(progress / 0.2);
      if (progress > 0.78) {
        return peak * smoothStep((1 - progress) / 0.22);
      }
      return peak;
    }),
    isEstimated: true,
  };
}

export function interpolateAltitude(
  first: number,
  second: number,
  progress: number,
) {
  return first + (second - first) * Math.max(0, Math.min(1, progress));
}

export function getPeakAltitude(altitudes: readonly number[]) {
  return altitudes.reduce(
    (peak, altitude) =>
      Math.max(peak, Number.isFinite(altitude) ? altitude : 0),
    0,
  );
}

export function estimateFlownAltitudeProfile(
  pointCount: number,
  currentAltitude: number,
) {
  const peak = Math.max(0, currentAltitude);
  if (pointCount === 1) return [peak];
  const lastIndex = Math.max(1, pointCount - 1);

  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / lastIndex;
    return peak * smoothStep(Math.min(1, progress / 0.2));
  });
}

/** Match ordered telemetry to actual coordinates, keeping estimates for gaps.
 * Work backwards so a retained path suffix uses the most recent samples when
 * telemetry contains older visits to the same coordinates.
 */
export function buildLiveAltitudeProfile(
  path: readonly (readonly [number, number])[],
  telemetry: readonly { lat: number; lon: number; altMSL: number }[],
  currentAltitude: number,
): AltitudeProfile {
  const altitudes = estimateFlownAltitudeProfile(path.length, currentAltitude);
  const samplesByPosition = new Map<
    string,
    { index: number; altitude: number }[]
  >();
  telemetry.forEach((sample, index) => {
    if (![sample.lat, sample.lon, sample.altMSL].every(Number.isFinite)) return;
    const key = `${sample.lat},${sample.lon}`;
    const samples = samplesByPosition.get(key) ?? [];
    samples.push({ index, altitude: sample.altMSL });
    samplesByPosition.set(key, samples);
  });
  let beforeSample = telemetry.length;
  let isEstimated = false;
  for (let index = path.length - 1; index >= 0; index--) {
    const point = path[index]!;
    const candidates = samplesByPosition.get(`${point[0]},${point[1]}`);
    while (candidates?.length && candidates.at(-1)!.index >= beforeSample)
      candidates.pop();
    const sample = candidates?.pop();
    if (sample) {
      altitudes[index] = sample.altitude;
      beforeSample = sample.index;
    } else {
      isEstimated = true;
    }
  }
  return { altitudes, isEstimated };
}
