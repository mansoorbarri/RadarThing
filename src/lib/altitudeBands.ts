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

export function getAltitudeBandIndex(altitude: number) {
  const index = ALTITUDE_BANDS.findIndex((band) => altitude < band.ceiling);
  return index < 0 ? ALTITUDE_BANDS.length - 1 : index;
}
