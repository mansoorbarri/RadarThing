import {
  type PositionUpdate,
  type TimedPositionSample,
} from "~/lib/aircraft-store";

export const RADAR_TRAIL_RENDER_LENGTH = 15;
export const RADAR_TRAIL_SAMPLE_INTERVAL_MS = 5000;
export const RADAR_TRAIL_MIN_SPEED_KTS = 50;
export const RADAR_TRAIL_COLOR = "#ff9a1f";
const RADAR_TRAIL_MAX_RADIUS_PX = 2.8;
const RADAR_TRAIL_MIN_RADIUS_PX = 1.2;

export interface RadarTrailDot {
  lat: number;
  lon: number;
  opacity: number;
  radius: number;
}

function isValidSample(sample: TimedPositionSample | undefined) {
  return Boolean(
    sample &&
      Number.isFinite(sample.lat) &&
      Number.isFinite(sample.lon) &&
      Number.isFinite(sample.ts),
  );
}

function getTrailSpeedKts(aircraft: PositionUpdate) {
  const observed = Number(aircraft.observedGroundSpeed ?? 0);
  const reported = Number(aircraft.speed ?? 0);
  return Math.max(
    0,
    Number.isFinite(observed) ? observed : 0,
    Number.isFinite(reported) ? reported : 0,
  );
}

function getTrailRadius(index: number) {
  if (RADAR_TRAIL_RENDER_LENGTH <= 1) return RADAR_TRAIL_MAX_RADIUS_PX;

  const progress = index / (RADAR_TRAIL_RENDER_LENGTH - 1);
  return (
    RADAR_TRAIL_MAX_RADIUS_PX -
    (RADAR_TRAIL_MAX_RADIUS_PX - RADAR_TRAIL_MIN_RADIUS_PX) * progress
  );
}

function getTrailOpacity(index: number) {
  const opacity = 1 - index / RADAR_TRAIL_RENDER_LENGTH;
  return Math.max(0.12, opacity);
}

export function buildRadarTrailDots(aircraft: PositionUpdate): RadarTrailDot[] {
  const speedKts = getTrailSpeedKts(aircraft);
  if (speedKts < RADAR_TRAIL_MIN_SPEED_KTS) return [];

  const samples = aircraft.trailSamples;
  if (!samples || samples.length < 2) return [];

  const dots: RadarTrailDot[] = [];
  let newestAcceptedTs = samples[samples.length - 1]?.ts ?? 0;

  for (let index = samples.length - 2; index >= 0; index--) {
    const sample = samples[index];
    if (!sample || !isValidSample(sample)) continue;

    if (newestAcceptedTs - sample.ts < RADAR_TRAIL_SAMPLE_INTERVAL_MS) {
      continue;
    }

    const ageIndex = dots.length;
    dots.push({
      lat: sample.lat,
      lon: sample.lon,
      opacity: getTrailOpacity(ageIndex),
      radius: getTrailRadius(ageIndex),
    });
    newestAcceptedTs = sample.ts;

    if (dots.length >= RADAR_TRAIL_RENDER_LENGTH) {
      break;
    }
  }

  return dots;
}
