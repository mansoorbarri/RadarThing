import type { PositionUpdate } from "./aircraft-store";

export const RT_DAY_RECORD = 50;
export const RT_DAY_TARGET = RT_DAY_RECORD + 1;
const MAX_SAMPLE_AGE_MS = 30_000;

export function validRtDayAircraft(aircraft: PositionUpdate, now: number) {
  return (
    Number.isFinite(aircraft.lat) &&
    Math.abs(aircraft.lat) <= 90 &&
    Number.isFinite(aircraft.lon) &&
    Math.abs(aircraft.lon) <= 180 &&
    Number.isFinite(aircraft.ts) &&
    now - aircraft.ts <= MAX_SAMPLE_AGE_MS &&
    aircraft.ts <= now + 5000
  );
}
