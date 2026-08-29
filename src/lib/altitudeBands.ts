export const ALTITUDE_BANDS = [
  { label: "< FL100", ceiling: 10_000, color: "#38bdf8" },
  { label: "FL100–199", ceiling: 20_000, color: "#22d3ee" },
  { label: "FL200–299", ceiling: 30_000, color: "#a3e635" },
  { label: "FL300–399", ceiling: 40_000, color: "#f59e0b" },
  { label: "FL400+", ceiling: Number.POSITIVE_INFINITY, color: "#f43f5e" },
] as const;

export const UNKNOWN_ALTITUDE_BAND = {
  label: "NO TELEMETRY",
  ceiling: Number.POSITIVE_INFINITY,
  color: "#64748b",
} as const;

export const ALTITUDE_RENDER_BANDS = [
  ...ALTITUDE_BANDS,
  UNKNOWN_ALTITUDE_BAND,
] as const;

export interface AltitudePathSegment<T> {
  points: T[];
  bandIndex: number;
}

export function getAltitudeBandIndex(altitude: number) {
  const index = ALTITUDE_BANDS.findIndex((band) => altitude < band.ceiling);
  return index < 0 ? ALTITUDE_BANDS.length - 1 : index;
}

export function buildAltitudePathSegments<T>(
  path: readonly T[],
  altitudes: readonly number[],
  altitudeKnown: readonly boolean[] = path.map(() => true),
): AltitudePathSegment<T>[] {
  const segments: AltitudePathSegment<T>[] = [];

  for (let index = 1; index < path.length; index += 1) {
    const previousPoint = path[index - 1];
    const point = path[index];
    if (previousPoint === undefined || point === undefined) continue;

    const previousAltitude = altitudes[index - 1];
    const altitude = altitudes[index];
    const hasAltitude =
      altitudeKnown[index - 1] !== false &&
      altitudeKnown[index] !== false &&
      Number.isFinite(previousAltitude) &&
      Number.isFinite(altitude);
    const bandIndex = hasAltitude
      ? getAltitudeBandIndex((previousAltitude! + altitude!) / 2)
      : ALTITUDE_BANDS.length;
    const activeSegment = segments[segments.length - 1];

    if (activeSegment?.bandIndex === bandIndex) {
      activeSegment.points.push(point);
    } else {
      segments.push({ points: [previousPoint, point], bandIndex });
    }
  }

  return segments;
}
