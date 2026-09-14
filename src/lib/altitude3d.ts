import type { PositionUpdate } from "./aircraft-store";
import { estimateFlownAltitudeProfile } from "./altitudeProfile";
import { ALTITUDE_RENDER_BANDS, getAltitudeBandIndex } from "./altitudeBands";

export interface AltitudeTrack {
  id: string;
  path: [number, number][];
  altitudes: number[];
  estimated: boolean;
  remaining?: boolean;
}

export function liveAltitudeTrack(aircraft: PositionUpdate): AltitudeTrack {
  const path = [...(aircraft.flightPath ?? [])];
  const altitude = Number(aircraft.altMSL ?? aircraft.alt);
  const altitudes = estimateFlownAltitudeProfile(path.length, altitude);
  const telemetry = aircraft.flightTelemetry ?? [];
  const start = Math.max(0, path.length - telemetry.length);
  telemetry.forEach((sample, index) => {
    if (start + index < path.length) altitudes[start + index] = sample.altMSL;
  });
  path.push([aircraft.lat, aircraft.lon]);
  altitudes.push(altitude);
  return {
    id: aircraft.callsign || aircraft.id,
    path,
    altitudes,
    estimated: start > 0,
  };
}

// Elevation for the shared map camera. The fixed visual scale keeps
// altitude differences readable at global zoom without changing map geography.
export function altitudeHeight(altitudeFeet: number) {
  return Number.isFinite(altitudeFeet)
    ? (Math.max(0, Math.min(100_000, altitudeFeet)) * 140) / 45_000
    : 0;
}

export function altitudeSegmentColor(first: number, second: number) {
  const band =
    Number.isFinite(first) && Number.isFinite(second)
      ? getAltitudeBandIndex((first + second) / 2)
      : ALTITUDE_RENDER_BANDS.length - 1;
  return ALTITUDE_RENDER_BANDS[band]!.color;
}
